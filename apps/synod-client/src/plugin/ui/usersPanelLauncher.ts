import type { App } from 'obsidian';
import { SYNOD_USERS_VIEW } from '../../ui/usersPanel';

export async function revealUsersPanel(app: App): Promise<void> {
  const { workspace } = app;
  const leaves = workspace.getLeavesOfType(SYNOD_USERS_VIEW);
  if (leaves.length > 0) {
    workspace.revealLeaf(leaves[0]);
    return;
  }

  const leaf = workspace.getRightLeaf(false);
  if (!leaf) return;

  await leaf.setViewState({ type: SYNOD_USERS_VIEW, active: true });
  workspace.revealLeaf(leaf);
}
