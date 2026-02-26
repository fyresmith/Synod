export function createInputBlocker(
  isLocked: () => boolean,
  modalId: string,
): (event: Event) => void {
  return (event: Event): void => {
    if (!isLocked()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(`#${modalId}`)) return;

    if (event.type === 'keydown' || event.type === 'keyup') {
      event.preventDefault();
      event.stopPropagation();
      (event as KeyboardEvent).stopImmediatePropagation?.();
      return;
    }

    const inWorkspace = Boolean(target?.closest('.workspace'));
    if (!inWorkspace) return;

    event.preventDefault();
    event.stopPropagation();
    (event as InputEvent).stopImmediatePropagation?.();
  };
}
