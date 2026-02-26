import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import authRoutes from '../../routes/auth.js';
import dashboardRoutes from '../../routes/dashboard.js';
import { getRoomStatus } from '../../lib/yjsServer.js';
import { clearDashboardCookie, getDashboardSession } from '../../lib/dashboardAuth.js';
import { loadManagedState } from '../../lib/managedState.js';

export function createHttpStack() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const setupRequired = (req, res, next) => {
    if (!String(process.env.VAULT_PATH ?? '').trim()) {
      return res.status(503).json({ ok: false, error: 'Setup required: configure vault path first.' });
    }
    next();
  };

  app.use('/auth', setupRequired, authRoutes);
  app.use('/dashboard', dashboardRoutes);

  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
  app.get('/rooms', async (req, res) => {
    const session = getDashboardSession(req);
    if (!session?.accountId) {
      return res.status(401).json({ ok: false, error: 'Owner dashboard session required.' });
    }

    const vaultPath = String(process.env.VAULT_PATH ?? '').trim();
    if (!vaultPath) {
      return res.status(503).json({ ok: false, error: 'Setup required: configure vault path first.' });
    }

    let state;
    try {
      state = await loadManagedState(vaultPath);
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed loading managed state.' });
    }

    if (!state) {
      return res.status(503).json({ ok: false, error: 'Managed vault is not initialized.' });
    }

    if (session.accountId !== state.ownerId) {
      clearDashboardCookie(req, res);
      return res.status(403).json({ ok: false, error: 'Owner session required.' });
    }

    return res.json({ rooms: getRoomStatus() });
  });

  function broadcastFileUpdated(relPath, hash, excludeSocketId) {
    io.sockets.sockets.forEach((sock) => {
      if (sock.id !== excludeSocketId) {
        sock.emit('file-updated', { relPath, hash });
      }
    });
  }

  return { app, httpServer, io, broadcastFileUpdated };
}
