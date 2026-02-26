import { dashboardPage } from '../views/layout.js';
import { escapeHtml } from './html.js';

export function sendDashboardError(res, err) {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).send(dashboardPage('Error', `<p>${escapeHtml(message)}</p>`));
}
