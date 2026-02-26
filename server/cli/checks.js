import { createServer } from 'net';
import { access } from 'fs/promises';

export async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function pathExists(pathValue) {
  if (!pathValue) return false;
  try {
    await access(pathValue);
    return true;
  } catch {
    return false;
  }
}

export function validateDomain(domain) {
  if (!domain) return false;
  return /^[a-zA-Z0-9.-]+$/.test(domain) && domain.includes('.');
}
