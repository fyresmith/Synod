import { createInputBlocker } from './inputBlocker';
import { OfflineMode, OfflineSnapshot, renderOfflineModal } from './modalView';

const OVERLAY_ID = 'synod-offline-overlay';
const MODAL_ID = 'synod-offline-modal';
const BODY_CLASS = 'vault-offline';

interface OfflineGuardOptions {
  onReconnect?: () => void;
  onDisable?: () => void;
  onSaveUrl?: (url: string) => Promise<void>;
  onLogout?: () => Promise<void>;
  getSnapshot?: () => OfflineSnapshot;
}

export class OfflineGuard {
  private locked = false;
  private mode: OfflineMode = 'disconnected';
  private readonly onReconnect?: () => void;
  private readonly onDisable?: () => void;
  private readonly onSaveUrl?: (url: string) => Promise<void>;
  private readonly onLogout?: () => Promise<void>;
  private readonly getSnapshot?: () => OfflineSnapshot;
  private readonly blockInput: (event: Event) => void;

  constructor(options: OfflineGuardOptions = {}) {
    this.onReconnect = options.onReconnect;
    this.onDisable = options.onDisable;
    this.onSaveUrl = options.onSaveUrl;
    this.onLogout = options.onLogout;
    this.getSnapshot = options.getSnapshot;
    this.blockInput = createInputBlocker(() => this.locked, MODAL_ID);
  }

  private renderModal(): void {
    renderOfflineModal({
      overlayId: OVERLAY_ID,
      modalId: MODAL_ID,
      mode: this.mode,
      getSnapshot: this.getSnapshot,
      onReconnect: this.onReconnect,
      onDisable: this.onDisable,
      onSaveUrl: this.onSaveUrl,
      onLogout: this.onLogout,
    });
  }

  lock(mode: OfflineMode = 'disconnected'): void {
    this.mode = mode;

    if (this.locked) {
      this.renderModal();
      return;
    }
    this.locked = true;

    document.body.addClass(BODY_CLASS);
    this.renderModal();

    if (mode === 'disconnected') return;

    window.addEventListener('keydown', this.blockInput, true);
    window.addEventListener('keyup', this.blockInput, true);
    document.addEventListener('beforeinput', this.blockInput, true);
    document.addEventListener('paste', this.blockInput, true);
    document.addEventListener('drop', this.blockInput, true);
    document.addEventListener('cut', this.blockInput, true);
    document.addEventListener('submit', this.blockInput, true);

    const active = document.activeElement as HTMLElement | null;
    if (active?.blur) active.blur();
  }

  unlock(): void {
    if (!this.locked) return;
    this.locked = false;

    window.removeEventListener('keydown', this.blockInput, true);
    window.removeEventListener('keyup', this.blockInput, true);
    document.removeEventListener('beforeinput', this.blockInput, true);
    document.removeEventListener('paste', this.blockInput, true);
    document.removeEventListener('drop', this.blockInput, true);
    document.removeEventListener('cut', this.blockInput, true);
    document.removeEventListener('submit', this.blockInput, true);

    document.body.removeClass(BODY_CLASS);
    document.getElementById(OVERLAY_ID)?.remove();
  }
}
