import jwt from 'jsonwebtoken';
import { describeManagedStatus, isMember, loadManagedState } from './managedState.js';

/**
 * Verify a JWT and return the decoded payload.
 * Throws if the token is invalid or expired.
 * @param {string} token
 * @returns {object} decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function getVaultPath() {
  const value = String(process.env.VAULT_PATH ?? '').trim();
  if (!value) throw new Error('VAULT_PATH env var is required');
  return value;
}

export async function getManagedContextForUser(user, vaultId) {
  const state = await loadManagedState(getVaultPath());
  if (!state) {
    throw new Error('Managed vault is not initialized');
  }
  if (!vaultId || vaultId !== state.vaultId) {
    throw new Error('Invalid vault ID');
  }
  if (!isMember(state, user.id)) {
    throw new Error('User is not paired with this managed vault');
  }

  return {
    state,
    status: describeManagedStatus(state, user.id),
  };
}

/**
 * Express middleware — reads Authorization: Bearer <token> header.
 */
export function expressMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = verifyToken(auth.slice(7));
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Socket.IO middleware — reads token from socket.handshake.auth.token.
 */
export function socketMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  const vaultId = socket.handshake.auth?.vaultId;
  if (!token) return next(new Error('No token'));
  (async () => {
    try {
      socket.user = verifyToken(token);
      socket.managed = await getManagedContextForUser(socket.user, vaultId);
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      next(new Error(message));
    }
  })();
}

/**
 * Verify a JWT for the y-websocket WS handshake + managed vault membership.
 * @param {string} token
 * @param {string} vaultId
 * @returns {Promise<object>} decoded payload
 */
export async function verifyManagedWsAccess(token, vaultId) {
  if (!token) throw new Error('No token');
  const user = verifyToken(token);
  await getManagedContextForUser(user, vaultId);
  return user;
}

/**
 * Verify a JWT for the y-websocket WS handshake.
 * @param {string} token
 * @returns {object} decoded payload
 */
export function verifyWsToken(token) {
  if (!token) throw new Error('No token');
  try {
    return verifyToken(token);
  } catch (err) {
    throw new Error('Invalid token');
  }
}
