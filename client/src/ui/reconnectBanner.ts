const BANNER_ID = 'synod-reconnect-banner';

export class ReconnectBanner {
  private el: HTMLElement | null = null;

  show(onReconnectNow: () => void): void {
    this.hide();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;

    const text = document.createElement('span');
    text.className = 'synod-reconnect-text';
    text.innerHTML = '⬡ Synod disconnected — reconnecting<span class="synod-reconnect-dots">...</span>';

    const btn = document.createElement('button');
    btn.className = 'synod-reconnect-btn';
    btn.textContent = 'Try now';
    btn.addEventListener('click', onReconnectNow);

    banner.appendChild(text);
    banner.appendChild(btn);
    document.body.appendChild(banner);
    this.el = banner;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(BANNER_ID)?.remove();
  }
}
