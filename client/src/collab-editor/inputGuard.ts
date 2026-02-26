import type { MarkdownView } from 'obsidian';
import type { CollabViewBinding } from './types';

const INPUT_GUARD_EVENTS = ['beforeinput', 'keydown', 'paste', 'drop', 'compositionstart'] as const;

export function installInputGuard(
  binding: CollabViewBinding,
  getViewContainer: (view: MarkdownView) => HTMLElement | null,
): void {
  const container = getViewContainer(binding.view);
  if (!container) return;

  if (binding.guardContainer === container) return;
  if (binding.guardContainer) {
    removeInputGuard(binding);
  }

  for (const type of INPUT_GUARD_EVENTS) {
    container.addEventListener(type, binding.guardHandler, true);
  }
  binding.guardContainer = container;
}

export function removeInputGuard(binding: CollabViewBinding): void {
  if (!binding.guardContainer) return;

  for (const type of INPUT_GUARD_EVENTS) {
    binding.guardContainer.removeEventListener(type, binding.guardHandler, true);
  }
  binding.guardContainer = null;
}
