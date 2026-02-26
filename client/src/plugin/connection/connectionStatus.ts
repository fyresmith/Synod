import type { ConnectionStatus } from '../../types';

export function getUnmanagedStatusLabel(hasToken: boolean): string {
  return hasToken ? '⬡ Synod Setup' : '⛶ Synod Setup';
}

export function getManagedStatusLabel(status: ConnectionStatus, remoteCount: number): string {
  const countSuffix = status === 'connected' && remoteCount > 0 ? ` · ${remoteCount}` : '';
  const labels: Record<ConnectionStatus, string> = {
    connected: `⬢ Synod${countSuffix}`,
    connecting: '⬡ Synod',
    disconnected: '⬡̸ Synod',
    'auth-required': '⛶ Synod',
  };
  return labels[status];
}
