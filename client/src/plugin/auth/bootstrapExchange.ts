import { Notice } from 'obsidian';
import type { ManagedVaultBinding, PluginSettings } from '../../types';
import { decodeUserFromToken } from '../../main/jwt';

interface BootstrapPayload {
  ok?: boolean;
  token?: string;
  user?: { id?: string; username?: string; avatarUrl?: string };
  error?: string;
}

interface ExchangeBootstrapTokenOptions {
  binding: ManagedVaultBinding | null;
  settings: PluginSettings;
  saveSettings: () => Promise<void>;
}

export async function exchangeBootstrapToken(options: ExchangeBootstrapTokenOptions): Promise<boolean> {
  const { binding, settings, saveSettings } = options;
  const bootstrapToken = String(settings.bootstrapToken ?? '').trim();
  if (!binding || !bootstrapToken) {
    return false;
  }

  try {
    const res = await fetch(`${binding.serverUrl}/auth/bootstrap/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bootstrapToken,
        vaultId: binding.vaultId,
      }),
    });

    const payload = (await res.json().catch(() => null)) as BootstrapPayload | null;

    if (!res.ok || !payload?.ok || !payload.token) {
      throw new Error(payload?.error || `Bootstrap exchange failed (${res.status})`);
    }

    const token = String(payload.token).trim();
    const user = decodeUserFromToken(token);

    settings.token = token;
    settings.user = user;
    settings.bootstrapToken = null;

    await saveSettings();
    new Notice(`Synod: Logged in as @${user.username}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const normalized = message.toLowerCase();
    if (
      normalized.includes('expired')
      || normalized.includes('invalid')
      || normalized.includes('pending')
      || normalized.includes('not found')
    ) {
      settings.bootstrapToken = null;
      await saveSettings();
    }
    new Notice(`Synod: Bootstrap sign-in failed — ${message}`);
    return false;
  }
}
