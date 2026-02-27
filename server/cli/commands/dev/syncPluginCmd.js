import { existsSync } from 'fs';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import chokidar from 'chokidar';
import { resolveContext } from '../../core/context.js';
import { CliError } from '../../errors.js';
import { EXIT } from '../../constants.js';
import { info, success, warn } from '../../output.js';

const PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'];

async function loadDevState(devStateFile) {
  try {
    const raw = await readFile(devStateFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveSourceDir(serverRoot, explicitSource) {
  if (explicitSource) return explicitSource;
  const clientDir = join(serverRoot, '../client');
  if (existsSync(clientDir)) return clientDir;
  return join(serverRoot, 'assets/plugin/synod');
}

async function ensureSynodInCommunityPlugins(vaultPath) {
  const obsidianDir = join(vaultPath, '.obsidian');
  await mkdir(obsidianDir, { recursive: true });

  const pluginsFile = join(obsidianDir, 'community-plugins.json');
  let plugins = [];

  if (existsSync(pluginsFile)) {
    try {
      const raw = await readFile(pluginsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) plugins = parsed;
    } catch {
      warn('community-plugins.json is corrupt — resetting');
    }
  }

  if (!plugins.includes('synod')) {
    plugins.push('synod');
    await writeFile(pluginsFile, JSON.stringify(plugins, null, 2), 'utf-8');
  }
}

async function doSync(vaultPath, sourceDir) {
  const pluginDir = join(vaultPath, '.obsidian/plugins/synod');
  await mkdir(pluginDir, { recursive: true });
  await ensureSynodInCommunityPlugins(vaultPath);

  let copied = 0;
  for (const file of PLUGIN_FILES) {
    const src = join(sourceDir, file);
    const dest = join(pluginDir, file);
    if (existsSync(src)) {
      await copyFile(src, dest);
      copied++;
    } else {
      warn(`Source file missing: ${src}`);
    }
  }

  if (copied === 0) {
    throw new CliError(`No plugin files found in source directory: ${sourceDir}`, EXIT.FAIL);
  }

  return copied;
}

async function resolveVaultPaths(options, devStateFile) {
  if (options.all) {
    const devState = await loadDevState(devStateFile);
    const vaults = devState?.vaults ?? {};
    const entries = Object.entries(vaults);
    if (entries.length === 0) {
      throw new CliError('No dev vaults seeded yet. Run: synod dev seed', EXIT.FAIL);
    }
    return entries.map(([name, entry]) => ({ name, vaultPath: entry.vaultPath }));
  }

  if (options.vaultPath) {
    return [{ name: options.name, vaultPath: options.vaultPath }];
  }

  const devState = await loadDevState(devStateFile);
  const entry = devState?.vaults?.[options.name];
  if (!entry) {
    throw new CliError(
      `Dev vault "${options.name}" not found. Run: synod dev seed --name ${options.name}`,
      EXIT.FAIL,
    );
  }
  return [{ name: options.name, vaultPath: entry.vaultPath }];
}

export function registerSyncPluginCommand(dev) {
  dev
    .command('sync-plugin')
    .description('Copy built plugin assets into a named dev vault')
    .option('--name <name>', 'vault alias to target', 'default')
    .option('--all', 'sync to all seeded dev vaults', false)
    .option('--vault-path <path>', 'explicit vault path (overrides dev state lookup)')
    .option('--source <path>', 'explicit source directory (overrides auto-detection)')
    .option('--watch', 'watch source files and re-sync on change', false)
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const devStateFile = join(dirname(envFile), '.synod-dev.json');

      const targets = await resolveVaultPaths(options, devStateFile);

      for (const { vaultPath } of targets) {
        if (!existsSync(vaultPath)) {
          throw new CliError(`Vault directory does not exist: ${vaultPath}`, EXIT.FAIL);
        }
      }

      // Resolve source directory (server root is 3 levels up from this file)
      const serverRoot = new URL('../../../', import.meta.url).pathname;
      const sourceDir = resolveSourceDir(serverRoot, options.source);

      if (!existsSync(sourceDir)) {
        throw new CliError(`Source directory does not exist: ${sourceDir}`, EXIT.FAIL);
      }

      info(`Source: ${sourceDir}`);

      for (const { name, vaultPath } of targets) {
        const count = await doSync(vaultPath, sourceDir);
        success(`[${name}] Synced ${count} file(s) → ${vaultPath}`);
      }

      if (options.watch) {
        const watchFiles = PLUGIN_FILES.map((f) => join(sourceDir, f));
        info(`Watching for changes (${targets.length} vault(s), Ctrl+C to stop)...`);

        const watcher = chokidar.watch(watchFiles, {
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 200 },
        });

        watcher.on('change', async (filePath) => {
          info(`Change detected: ${filePath}`);
          for (const { name, vaultPath } of targets) {
            try {
              const n = await doSync(vaultPath, sourceDir);
              success(`[${name}] Synced ${n} file(s)`);
            } catch (err) {
              warn(`[${name}] Sync failed: ${err.message}`);
            }
          }
        });

        await new Promise((res) => process.on('SIGINT', () => { watcher.close(); res(); }));
      }
    });
}
