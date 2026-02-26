import { platform } from 'os';
import { randomBytes } from 'crypto';
import { loadEnvFile, normalizeEnv, writeEnvFile } from '../../env-file.js';
import { info, success } from '../../output.js';
import { resolveContext, loadValidatedEnv } from '../../core/context.js';
import { startSynodServer } from '../../../index.js';
import { run } from '../../exec.js';

export function registerDashboardCommand(program) {
  program
    .command('dashboard')
    .description('Start/open the owner dashboard')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const { env } = await loadValidatedEnv(envFile, { requireFile: false, requireVaultPath: false });

      const port = String(env.PORT || '3000').trim();
      const serverUrl = String(env.SYNOD_SERVER_URL || '').trim() || `http://localhost:${port}`;
      const dashboardUrl = `${serverUrl}/dashboard`;
      const localUrl = `http://127.0.0.1:${port}`;
      const useLocalRuntime = !String(env.SYNOD_SERVER_URL || '').trim();

      if (useLocalRuntime) {
        if (!String(env.JWT_SECRET || '').trim()) {
          const existing = await loadEnvFile(envFile);
          const next = normalizeEnv(existing);
          next.JWT_SECRET = randomBytes(32).toString('hex');
          await writeEnvFile(envFile, next);
          env.JWT_SECRET = next.JWT_SECRET;
          info(`Generated JWT_SECRET in ${envFile}`);
        }

        const health = await fetch(`${localUrl}/health`).then((res) => res.ok).catch(() => false);
        if (!health) {
          await startSynodServer({ envFile, quiet: true, allowSetupMode: true });
          info(`Synod server started using env: ${envFile}`);
        }
      }

      console.log(`Dashboard: ${dashboardUrl}`);

      const opener = platform() === 'win32' ? 'explorer' : platform() === 'darwin' ? 'open' : 'xdg-open';
      try {
        await run(opener, [dashboardUrl]);
        success('Opened dashboard in browser');
      } catch {
        info('Could not open browser automatically. Visit the URL above.');
      }
    });
}
