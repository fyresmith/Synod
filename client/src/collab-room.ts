export interface CollabRoom {
  attach(): void;
  attachView(bindingKey: string, view: any): void;
  detachView(bindingKey: string): void;
  isEmpty(): boolean;
  destroy(): void;
  updateLocalCursorPreferences(color: string | null, useProfileForCursor: boolean): void;
}
