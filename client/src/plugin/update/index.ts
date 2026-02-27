import { createHash } from 'crypto';
import type { DataAdapter } from 'obsidian';
import type { InstallResult, UpdateCheckResult, UpdateReleaseInfo } from '../../types';

const OWNER = 'fyresmith';
const REPO = 'Synod';
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100`;
const CLIENT_TAG_PREFIX = /^synod-client-v/i;
const REQUIRED_ASSETS = ['manifest.json', 'main.js', 'styles.css'] as const;
const CACHE_DIR = '.updates';
const CACHE_META_FILE = 'cache-meta.json';

type RequiredAssetName = (typeof REQUIRED_ASSETS)[number];
type RequiredAssetRecord<T> = { [K in RequiredAssetName]: T };

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
  mkdir?: (path: string) => Promise<void>;
  rmdir?: (path: string, recursive?: boolean) => Promise<void>;
}

interface DownloadedAsset {
  assetName: RequiredAssetName;
  content: string;
}

interface CachedUpdateMetadata {
  version: string;
  fetchedAt: string;
  checksums: UpdateReleaseInfo['checksums'];
}

interface CachedBundle {
  version: string;
  fetchedAt: string;
  checksums: UpdateReleaseInfo['checksums'];
  assets: RequiredAssetRecord<string>;
}

export interface CheckAndPrefetchResult {
  result: UpdateCheckResult;
  cachedVersion: string | null;
  cachedFetchedAt: string | null;
}

export interface PrefetchResult {
  version: string;
  fetchedAt: string;
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

function normalizeChecksums(checksums: UpdateReleaseInfo['checksums']): UpdateReleaseInfo['checksums'] {
  return {
    'manifest.json': checksums['manifest.json'].toLowerCase(),
    'main.js': checksums['main.js'].toLowerCase(),
    'styles.css': checksums['styles.css'].toLowerCase(),
  };
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function isValidChecksums(value: unknown): value is UpdateReleaseInfo['checksums'] {
  const v = value as UpdateReleaseInfo['checksums'] | null;
  if (!v || typeof v !== 'object') return false;
  return REQUIRED_ASSETS.every((asset) => isSha256Hex(String(v[asset] ?? '').trim()));
}

function selectLatestStableClientRelease(releases: GitHubReleasePayload[]): {
  payload: GitHubReleasePayload;
  version: string;
} | null {
  let best: { payload: GitHubReleasePayload; version: string } | null = null;
  for (const payload of releases) {
    if (payload.draft || payload.prerelease) continue;
    const tag = String(payload.tag_name ?? '').trim();
    if (!CLIENT_TAG_PREFIX.test(tag)) continue;
    const version = extractVersionFromTag(tag);
    if (!parseSemver(version)) continue;

    if (!best || compareSemver(version, best.version) > 0) {
      best = { payload, version };
    }
  }
  return best;
}

function requireReleaseAssetMap(payload: GitHubReleasePayload, version: string): {
  release: UpdateReleaseInfo;
  checksumsUrl: string;
} {
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
  const payloads = await fetchJson<GitHubReleasePayload[]>(RELEASES_API);
  if (!Array.isArray(payloads)) {
    throw new Error('Unexpected release response format from GitHub.');
  }

  const selected = selectLatestStableClientRelease(payloads);
  if (!selected) {
    throw new Error('No stable synod-client release tags were found.');
  }

  const { release, checksumsUrl } = requireReleaseAssetMap(selected.payload, selected.version);
  const checksumContent = await fetchText(checksumsUrl);
  const checksums = parseChecksums(checksumContent);

  for (const asset of REQUIRED_ASSETS) {
    const hash = checksums.get(asset);
    if (!hash) {
      throw new Error(`checksums.txt is missing ${asset}`);
    }
    release.checksums[asset] = hash.toLowerCase();
  }

  return release;
}

function makeResult(result: Omit<UpdateCheckResult, 'checkedAt'>): UpdateCheckResult {
  return {
    ...result,
    checkedAt: new Date().toISOString(),
  };
}

function dirname(path: string): string {
  const normalized = String(path ?? '').replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '';
  return normalized.slice(0, idx);
}

function pluginFilePath(pluginId: string, filename: string): string {
  return `.obsidian/plugins/${pluginId}/${filename}`;
}

function cacheRootPath(pluginId: string): string {
  return pluginFilePath(pluginId, CACHE_DIR);
}

function cacheMetaPath(pluginId: string): string {
  return pluginFilePath(pluginId, `${CACHE_DIR}/${CACHE_META_FILE}`);
}

function cacheVersionDir(pluginId: string, version: string): string {
  return pluginFilePath(pluginId, `${CACHE_DIR}/${version}`);
}

function cacheAssetPath(pluginId: string, version: string, assetName: RequiredAssetName): string {
  return pluginFilePath(pluginId, `${CACHE_DIR}/${version}/${assetName}`);
}

function requireAdapter(
  adapter: DataAdapter,
): Required<Pick<AdapterWithFileOps, 'exists' | 'read' | 'write' | 'rename' | 'remove'>> & Pick<AdapterWithFileOps, 'mkdir' | 'rmdir'> {
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
    mkdir: typeof anyAdapter.mkdir === 'function' ? anyAdapter.mkdir.bind(anyAdapter) : undefined,
    rmdir: typeof anyAdapter.rmdir === 'function' ? anyAdapter.rmdir.bind(anyAdapter) : undefined,
  };
}

async function ensureDir(
  fs: Required<Pick<AdapterWithFileOps, 'exists'>> & Pick<AdapterWithFileOps, 'mkdir'>,
  path: string,
): Promise<void> {
  if (await fs.exists(path)) return;
  const parent = dirname(path);
  if (parent && !(await fs.exists(parent))) {
    await ensureDir(fs, parent);
  }
  if (!fs.mkdir) {
    throw new Error('Current vault adapter does not support update cache directory creation.');
  }
  await fs.mkdir(path);
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

async function removePath(
  fs: Required<Pick<AdapterWithFileOps, 'remove'>> & Pick<AdapterWithFileOps, 'rmdir'>,
  path: string,
): Promise<void> {
  try {
    await fs.remove(path);
    return;
  } catch {
    if (!fs.rmdir) return;
  }

  try {
    await (fs.rmdir as any)(path, true);
  } catch {
    // best effort
  }
}

async function readCacheMeta(
  fs: Required<Pick<AdapterWithFileOps, 'exists' | 'read'>>,
  pluginId: string,
): Promise<CachedUpdateMetadata | null> {
  const path = cacheMetaPath(pluginId);
  if (!(await fs.exists(path))) return null;

  try {
    const raw = await fs.read(path);
    const parsed = JSON.parse(raw) as CachedUpdateMetadata;
    if (!parseSemver(String(parsed?.version ?? ''))) return null;
    const fetchedAt = String(parsed?.fetchedAt ?? '').trim();
    if (!fetchedAt) return null;
    if (!isValidChecksums(parsed?.checksums)) return null;
    return {
      version: parsed.version,
      fetchedAt,
      checksums: normalizeChecksums(parsed.checksums),
    };
  } catch {
    return null;
  }
}

async function writeCacheMeta(
  fs: Required<Pick<AdapterWithFileOps, 'write' | 'exists'>> & Pick<AdapterWithFileOps, 'mkdir'>,
  pluginId: string,
  meta: CachedUpdateMetadata,
): Promise<void> {
  await ensureDir(fs, cacheRootPath(pluginId));
  await fs.write(cacheMetaPath(pluginId), `${JSON.stringify(meta, null, 2)}\n`);
}

async function removeCachedVersion(
  fs: Required<Pick<AdapterWithFileOps, 'remove'>> & Pick<AdapterWithFileOps, 'rmdir'>,
  pluginId: string,
  version: string,
): Promise<void> {
  for (const assetName of REQUIRED_ASSETS) {
    await removePath(fs, cacheAssetPath(pluginId, version, assetName));
  }
  await removePath(fs, cacheVersionDir(pluginId, version));
}

async function clearCachedUpdate(
  fs: Required<Pick<AdapterWithFileOps, 'exists' | 'read' | 'remove'>> & Pick<AdapterWithFileOps, 'rmdir'>,
  pluginId: string,
): Promise<void> {
  const meta = await readCacheMeta(fs, pluginId);
  if (meta) {
    await removeCachedVersion(fs, pluginId, meta.version);
  }
  await removePath(fs, cacheMetaPath(pluginId));
}

function asDownloadedAssets(assets: RequiredAssetRecord<string>): DownloadedAsset[] {
  return REQUIRED_ASSETS.map((assetName) => ({
    assetName,
    content: assets[assetName],
  }));
}

async function downloadAndVerifyReleaseAssets(release: UpdateReleaseInfo): Promise<DownloadedAsset[]> {
  const checksums = normalizeChecksums(release.checksums);
  return Promise.all(REQUIRED_ASSETS.map(async (assetName) => {
    const content = await fetchText(release.assets[assetName]);
    const expected = checksums[assetName];
    const actual = hashString(content);
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${assetName}.`);
    }
    return { assetName, content };
  }));
}

async function readCachedBundle(
  fs: Required<Pick<AdapterWithFileOps, 'exists' | 'read'>>,
  pluginId: string,
  options: {
    expectedVersion?: string | null;
    expectedChecksums?: UpdateReleaseInfo['checksums'] | null;
  } = {},
): Promise<CachedBundle | null> {
  const meta = await readCacheMeta(fs, pluginId);
  if (!meta) return null;
  if (options.expectedVersion && meta.version !== options.expectedVersion) return null;

  const checksums = normalizeChecksums(options.expectedChecksums ?? meta.checksums);
  const assets = {} as RequiredAssetRecord<string>;

  for (const assetName of REQUIRED_ASSETS) {
    const path = cacheAssetPath(pluginId, meta.version, assetName);
    if (!(await fs.exists(path))) return null;
    const content = await fs.read(path);
    const actual = hashString(content);
    if (actual !== checksums[assetName]) return null;
    assets[assetName] = content;
  }

  return {
    version: meta.version,
    fetchedAt: meta.fetchedAt,
    checksums,
    assets,
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

export async function prefetchClientUpdate(options: {
  adapter: DataAdapter;
  pluginId: string;
  release: UpdateReleaseInfo;
}): Promise<PrefetchResult> {
  const { adapter, pluginId, release } = options;
  const fs = requireAdapter(adapter);
  const previousMeta = await readCacheMeta(fs, pluginId);
  const downloads = await downloadAndVerifyReleaseAssets(release);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stagePaths: string[] = [];

  try {
    await ensureDir(fs, cacheRootPath(pluginId));
    await ensureDir(fs, cacheVersionDir(pluginId, release.version));

    for (const file of downloads) {
      const finalPath = cacheAssetPath(pluginId, release.version, file.assetName);
      const stagePath = `${finalPath}.stage-${stamp}`;
      await fs.write(stagePath, file.content);
      stagePaths.push(stagePath);

      if (await fs.exists(finalPath)) {
        await fs.remove(finalPath);
      }
      await fs.rename(stagePath, finalPath);
    }

    const fetchedAt = new Date().toISOString();
    await writeCacheMeta(fs, pluginId, {
      version: release.version,
      fetchedAt,
      checksums: normalizeChecksums(release.checksums),
    });

    if (previousMeta && previousMeta.version !== release.version) {
      await removeCachedVersion(fs, pluginId, previousMeta.version);
    }

    return {
      version: release.version,
      fetchedAt,
    };
  } catch (err) {
    await cleanupFiles(fs.remove, stagePaths);
    throw err;
  }
}

export async function checkAndPrefetchClientUpdate(options: {
  adapter: DataAdapter;
  pluginId: string;
  currentVersion: string;
}): Promise<CheckAndPrefetchResult> {
  const { adapter, pluginId, currentVersion } = options;
  const result = await checkForClientUpdate(currentVersion);

  if (result.status === 'error') {
    return {
      result,
      cachedVersion: null,
      cachedFetchedAt: null,
    };
  }

  let fs: ReturnType<typeof requireAdapter>;
  try {
    fs = requireAdapter(adapter);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: makeResult({
        status: 'error',
        currentVersion,
        message,
      }),
      cachedVersion: null,
      cachedFetchedAt: null,
    };
  }

  if (result.status === 'up_to_date') {
    try {
      await clearCachedUpdate(fs, pluginId);
    } catch {
      // Best-effort cache cleanup when already up to date.
    }
    return {
      result,
      cachedVersion: null,
      cachedFetchedAt: null,
    };
  }

  try {
    const cached = await prefetchClientUpdate({
      adapter,
      pluginId,
      release: result.latestRelease,
    });

    return {
      result: {
        ...result,
        message: `Update available: v${currentVersion} -> v${result.latestRelease.version}. Fetched and ready to install.`,
      },
      cachedVersion: cached.version,
      cachedFetchedAt: cached.fetchedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: makeResult({
        status: 'error',
        currentVersion,
        message: `Update found (v${result.latestRelease.version}) but fetch failed: ${message}`,
      }),
      cachedVersion: null,
      cachedFetchedAt: null,
    };
  }
}

export async function installClientUpdate(options: {
  adapter: DataAdapter;
  pluginId: string;
  release?: UpdateReleaseInfo | null;
  currentVersion: string;
  cachedVersionHint?: string | null;
}): Promise<InstallResult> {
  const { adapter, pluginId, release, currentVersion, cachedVersionHint } = options;
  const fs = requireAdapter(adapter);

  const targetVersion = String(release?.version ?? cachedVersionHint ?? '').trim();
  if (!targetVersion) {
    throw new Error('No pending update to install.');
  }

  const cached = await readCachedBundle(fs, pluginId, {
    expectedVersion: targetVersion,
    expectedChecksums: release?.checksums ?? null,
  });

  let downloads: DownloadedAsset[];
  let toVersion = targetVersion;

  if (cached) {
    downloads = asDownloadedAssets(cached.assets);
    toVersion = cached.version;
  } else if (release) {
    downloads = await downloadAndVerifyReleaseAssets(release);
    toVersion = release.version;
  } else {
    throw new Error(`No cached update found for v${targetVersion}. Run "Check & fetch latest synod-client" first.`);
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stagePaths: string[] = [];
  const backupPaths: string[] = [];

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
    }

    await cleanupFiles(fs.remove, backupPaths);
    try {
      await clearCachedUpdate(fs, pluginId);
    } catch {
      // best effort
    }
    return {
      status: 'success',
      fromVersion: currentVersion,
      toVersion,
      message: `Synod updated to v${toVersion}.`,
    };
  } catch (err) {
    let restored = false;
    for (const assetName of REQUIRED_ASSETS) {
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
      toVersion,
      message: restored
        ? `Update failed and changes were rolled back: ${message}`
        : `Update failed: ${message}`,
    };
  }
}
