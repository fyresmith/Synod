import type { Compartment } from '@codemirror/state';
import type { MarkdownView } from 'obsidian';

export interface CollabViewBinding {
  view: MarkdownView;
  collabCompartment: Compartment | null;
  readOnlyCompartment: Compartment | null;
  collabAttached: boolean;
  editorPollTimer: ReturnType<typeof setTimeout> | null;
  loading: boolean;
  overlayEl: HTMLElement | null;
  guardContainer: HTMLElement | null;
  guardHandler: (evt: Event) => void;
  caretObserver: MutationObserver | null;
  caretObserverTarget: HTMLElement | null;
  bannerEl: HTMLElement | null;
  markersEl: HTMLElement | null;
}
