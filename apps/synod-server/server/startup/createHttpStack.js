import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import authRoutes from '../../routes/auth.js';
import dashboardRoutes from '../../routes/dashboard.js';
import { getRoomStatus } from '../../lib/yjsServer.js';

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
  app.get('/rooms', (req, res) => res.json({ rooms: getRoomStatus() }));

  function broadcastFileUpdated(relPath, hash, excludeSocketId) {
    io.sockets.sockets.forEach((sock) => {
      if (sock.id !== excludeSocketId) {
        sock.emit('file-updated', { relPath, hash });
      }
    });
  }

  return { app, httpServer, io, broadcastFileUpdated };
}
