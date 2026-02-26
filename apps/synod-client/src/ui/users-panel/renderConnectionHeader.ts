import type SynodPlugin from '../../plugin/SynodPlugin';

export function renderConnectionHeader(root: HTMLElement, plugin: SynodPlugin): void {
  const header = root.createDiv({ cls: 'synod-panel-conn-header' });
  const status = plugin.getStatus();
  const pm = plugin.presenceManager;

  const dot = header.createSpan({ cls: 'synod-conn-dot' });

  if (status === 'connected') {
    dot.addClass('is-connected');
    const total = (pm?.getRemoteUserCount() ?? 0) + 1;
    header.createSpan({ text: total === 1 ? 'Only you in session' : `${total} in session` });
  } else if (status === 'connecting') {
    dot.addClass('is-connecting');
    header.createSpan({ text: 'Connecting…' });
  } else if (status === 'auth-required') {
    header.createSpan({ text: 'Not signed in' });
  } else {
    header.createSpan({ text: 'Not connected' });
  }
}
