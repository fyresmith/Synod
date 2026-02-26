import { createHash } from 'crypto';
import type { DataAdapter } from 'obsidian';
import type { InstallResult, UpdateCheckResult, UpdateReleaseInfo } from '../../types';

const OWNER = 'fyresmith';
const REPO = 'Synod';
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const REQUIRED_ASSETS = ['manifest.json', 'main.js', 'styles.css'] as const;

type RequiredAssetName = (typeof REQUIRED_ASSETS)[number];

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  prerelease?: boolean;
  draft?: boolean;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

interface AdapterWithFileOps extends DataAdapter {
  exists?: (path: string) => Promise<boolean>;
  read?: (path: string) => Promise<string>;
  write?: (path: string, data: string) => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
}

function hashString(content: string): string {
  return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

function parseSemver(input: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
} | null {
  const match = String(input ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return a.localeCompare(b);

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;

  const leftPre = left.prerelease;
  const rightPre = right.prerelease;
  if (leftPre.length === 0 && rightPre.length === 0) return 0;
  if (leftPre.length === 0) return 1;
  if (rightPre.length === 0) return -1;

  const count = Math.max(leftPre.length, rightPre.length);
  for (let i = 0; i < count; i += 1) {
    const l = leftPre[i];
    const r = rightPre[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;

    const lNum = Number(l);
    const rNum = Number(r);
    const lIsNum = Number.isFinite(lNum) && String(lNum) === l;
    const rIsNum = Number.isFinite(rNum) && String(rNum) === r;

    if (lIsNum && rIsNum && lNum !== rNum) return lNum - rNum;
    if (lIsNum && !rIsNum) return -1;
    if (!lIsNum && rIsNum) return 1;
    const cmp = l.localeCompare(r);
    if (cmp !== 0) return cmp;
  }

  return 0;
}

function parseRateLimitHint(response: Response): string {
  const retryAfter = Number(response.headers.get('retry-after') ?? '');
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return `Rate limit reached. Retry in ${Math.ceil(retryAfter)} seconds.`;
  }

  const resetEpoch = Number(response.headers.get('x-ratelimit-reset') ?? '');
  if (Number.isFinite(resetEpoch) && resetEpoch > 0) {
    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = Math.max(0, resetEpoch - now);
    if (waitSeconds > 0) {
      return `Rate limit reached. Retry in about ${Math.ceil(waitSeconds / 60)} minute(s).`;
    }
  }

  return 'Rate limit reached. Please wait and try again.';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(parseRateLimitHint(response));
  }

  if (!response.ok) {
    throw new Error(`Update check failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (response.status === 403 || response.status === 429) {
    throw new Error(parseRateLimitHint(response));
  }
  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status})`);
  }
  return response.text();
}

function extractVersionFromTag(tagName: string): string {
  const normalized = String(tagName ?? '').trim();
  return normalized.replace(/^synod-client-v/i, '').replace(/^v/i, '');
}

function parseChecksums(content: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = String(content ?? '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) continue;
    out.set(match[2].trim(), match[1].toLowerCase());
  }
  return out;
}

function requireReleaseAssetMap(payload: GitHubReleasePayload): {
  release: UpdateReleaseInfo;
  checksumsUrl: string;
} {
  if (payload.prerelease || payload.draft) {
    throw new Error('No stable release is currently available.');
  }

  const version = extractVersionFromTag(String(payload.tag_name ?? ''));
  if (!parseSemver(version)) {
    throw new Error('Latest release tag does not contain a valid version.');
  }

  const assets = Array.isArray(payload.assets) ? payload.assets : [];
  const assetMap = new Map<string, string>();
  for (const asset of assets) {
    const name = String(asset?.name ?? '').trim();
    const url = String(asset?.browser_download_url ?? '').trim();
    if (!name || !url) continue;
    assetMap.set(name, url);
  }

  const checksumsUrl = assetMap.get('checksums.txt');
  if (!checksumsUrl) {
    throw new Error('Release is missing checksums.txt');
  }

  const releaseAssets: UpdateReleaseInfo['assets'] = {
    'manifest.json': '',
    'main.js': '',
    'styles.css': '',
  };

  for (const asset of REQUIRED_ASSETS) {
    const url = assetMap.get(asset);
    if (!url) {
      throw new Error(`Release is missing ${asset}`);
    }
    releaseAssets[asset] = url;
  }

  return {
    release: {
      version,
      prerelease: Boolean(payload.prerelease),
      publishedAt: String(payload.published_at ?? ''),
      assets: releaseAssets,
      checksums: {
        'manifest.json': '',
        'main.js': '',
        'styles.css': '',
      },
    },
    checksumsUrl,
  };
}

async function loadLatestRelease(): Promise<UpdateReleaseInfo> {
  const payload = await fetchJson<GitHubReleasePayload>(RELEASES_API);
  const { release, checksumsUrl } = requireReleaseAssetMap(payload);

  const checksumContent = await fetchText(checksumsUrl);
  const checksums = parseChecksums(checksumContent);

  for (const asset of REQUIRED_ASSETS) {
    const hash = checksums.get(asset);
    if (!hash) {
      throw new Error(`checksums.txt is missing ${asset}`);
    }
    release.checksums[asset] = hash;
  }

  return release;
}

function makeResult(result: Omit<UpdateCheckResult, 'checkedAt'>): UpdateCheckResult {
  return {
    ...result,
    checkedAt: new Date().toISOString(),
  };
}

export async function checkForClientUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  try {
    const release = await loadLatestRelease();
    const isNewer = compareSemver(release.version, currentVersion) > 0;

    if (!isNewer) {
      return makeResult({
        status: 'up_to_date',
        currentVersion,
        latestRelease: release,
        message: `Synod is up to date (v${currentVersion}).`,
      });
    }

    return makeResult({
      status: 'update_available',
      currentVersion,
      latestRelease: release,
      message: `Update available: v${currentVersion} -> v${release.version}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult({
      status: 'error',
      currentVersion,
      message,
    });
  }
}

function requireAdapter(adapter: DataAdapter): Required<Pick<AdapterWithFileOps, 'exists' | 'read' | 'write' | 'rename' | 'remove'>> {
  const anyAdapter = adapter as AdapterWithFileOps;
  if (
    typeof anyAdapter.exists !== 'function'
    || typeof anyAdapter.read !== 'function'
    || typeof anyAdapter.write !== 'function'
    || typeof anyAdapter.rename !== 'function'
    || typeof anyAdapter.remove !== 'function'
  ) {
    throw new Error('Current vault adapter does not support plugin update operations.');
  }

  return {
    exists: anyAdapter.exists.bind(anyAdapter),
    read: anyAdapter.read.bind(anyAdapter),
    write: anyAdapter.write.bind(anyAdapter),
    rename: anyAdapter.rename.bind(anyAdapter),
    remove: anyAdapter.remove.bind(anyAdapter),
  };
}

function pluginFilePath(pluginId: string, filename: string): string {
  return `.obsidian/plugins/${pluginId}/${filename}`;
}

async function cleanupFiles(remove: (path: string) => Promise<void>, paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await remove(path);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export async function installClientUpdate(options: {
  adapter: DataAdapter;
  pluginId: string;
  release: UpdateReleaseInfo;
  currentVersion: string;
}): Promise<InstallResult> {
  const { adapter, pluginId, release, currentVersion } = options;
  const fs = requireAdapter(adapter);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const downloads = await Promise.all(REQUIRED_ASSETS.map(async (assetName) => {
    const content = await fetchText(release.assets[assetName]);
    const expected = release.checksums[assetName];
    const actual = hashString(content);
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${assetName}.`);
    }
    return { assetName, content };
  }));

  const stagePaths: string[] = [];
  const backupPaths: string[] = [];
  const promotedTargets: string[] = [];

  try {
    for (const file of downloads) {
      const stagePath = pluginFilePath(pluginId, `${file.assetName}.stage-${stamp}`);
      await fs.write(stagePath, file.content);
      stagePaths.push(stagePath);
    }

    for (const file of downloads) {
      const targetPath = pluginFilePath(pluginId, file.assetName);
      const backupPath = pluginFilePath(pluginId, `${file.assetName}.backup-${stamp}`);

      if (await fs.exists(targetPath)) {
        await fs.rename(targetPath, backupPath);
        backupPaths.push(backupPath);
      }

      const stagePath = pluginFilePath(pluginId, `${file.assetName}.stage-${stamp}`);
      await fs.rename(stagePath, targetPath);
      promotedTargets.push(targetPath);
    }

    await cleanupFiles(fs.remove, backupPaths);
    return {
      status: 'success',
      fromVersion: currentVersion,
      toVersion: release.version,
      message: `Synod updated to v${release.version}.`,
    };
  } catch (err) {
    let restored = false;
    for (const file of downloads) {
      const assetName = file.assetName;
      const targetPath = pluginFilePath(pluginId, assetName);
      const backupPath = pluginFilePath(pluginId, `${assetName}.backup-${stamp}`);
      try {
        if (await fs.exists(backupPath)) {
          if (await fs.exists(targetPath)) {
            await fs.remove(targetPath);
          }
          await fs.rename(backupPath, targetPath);
          restored = true;
        }
      } catch {
        // Keep trying to restore remaining files.
      }
    }

    await cleanupFiles(fs.remove, stagePaths);

    const message = err instanceof Error ? err.message : String(err);
    return {
      status: restored ? 'rolled_back' : 'failed',
      fromVersion: currentVersion,
      toVersion: release.version,
      message: restored
        ? `Update failed and changes were rolled back: ${message}`
        : `Update failed: ${message}`,
    };
  }
}
