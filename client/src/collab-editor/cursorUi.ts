import type { EditorView } from '@codemirror/view';
import type { MarkdownView } from 'obsidian';
import type { CollabViewBinding } from './types';

function labelTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? '#1a1a1a' : '#ffffff';
}

interface ApplyCursorUiOptions {
  binding: CollabViewBinding;
  usersByName: Map<string, any>;
  useProfileForCursor: boolean;
  getEditorView: (view: MarkdownView) => EditorView | null;
}

export function applyCursorUi(options: ApplyCursorUiOptions): void {
  const { binding, usersByName, useProfileForCursor, getEditorView } = options;
  const cm = getEditorView(binding.view);
  if (!cm) return;

  const carets = cm.dom.querySelectorAll('.cm-ySelectionCaret');
  carets.forEach((caretNode) => {
    const caret = caretNode as HTMLElement;
    const info = caret.querySelector('.cm-ySelectionInfo') as HTMLElement | null;
    if (!info) return;

    const existingName = info.dataset.synodName;
    const currentText = (info.textContent ?? '').trim();
    const name = existingName ?? currentText;
    if (!name) return;
    info.dataset.synodName = name;

    const remote = usersByName.get(name);
    const useProfile = Boolean(useProfileForCursor && remote?.avatarUrl);

    if (!useProfile) {
      caret.classList.remove('synod-caret-uses-profile');
      info.classList.remove('synod-caret-profile-info');
      info.style.removeProperty('--synod-caret-color');
      info.setAttribute('aria-label', name);
      const img = info.querySelector('.synod-caret-profile-image');
      if (img) img.remove();
      if (currentText !== name) {
        info.textContent = name;
      }
      info.style.color = labelTextColor(remote?.color ?? '#888888');
      return;
    }

    caret.classList.add('synod-caret-uses-profile');
    info.classList.add('synod-caret-profile-info');
    info.style.setProperty('--synod-caret-color', remote.color ?? '#ffffff');
    info.setAttribute('aria-label', name);
    if (info.textContent) {
      info.textContent = '';
    }

    let img = info.querySelector('.synod-caret-profile-image') as HTMLImageElement | null;
    if (!img) {
      img = document.createElement('img');
      img.className = 'synod-caret-profile-image';
      info.appendChild(img);
    }
    if (img.src !== remote.avatarUrl) {
      img.src = remote.avatarUrl;
    }
    img.alt = name;
  });
}

interface InstallCaretObserverOptions {
  binding: CollabViewBinding;
  getEditorView: (view: MarkdownView) => EditorView | null;
  onEditorMissing: () => void;
  onCaretMutation: () => void;
}

export function installCaretObserver(options: InstallCaretObserverOptions): void {
  const { binding, getEditorView, onEditorMissing, onCaretMutation } = options;
  const cm = getEditorView(binding.view);
  if (!cm) {
    onEditorMissing();
    return;
  }

  if (binding.caretObserver && binding.caretObserverTarget === cm.dom) {
    onCaretMutation();
    return;
  }

  if (binding.caretObserver) {
    binding.caretObserver.disconnect();
    binding.caretObserver = null;
    binding.caretObserverTarget = null;
  }

  const observer = new MutationObserver(() => {
    onCaretMutation();
  });
  observer.observe(cm.dom, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  binding.caretObserver = observer;
  binding.caretObserverTarget = cm.dom;
  onCaretMutation();
}

export function removeCaretObserver(binding: CollabViewBinding): void {
  if (!binding.caretObserver) return;
  binding.caretObserver.disconnect();
  binding.caretObserver = null;
  binding.caretObserverTarget = null;
}
