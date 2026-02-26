import process from 'process';
import { EXIT } from './constants.js';
import { CliError } from './errors.js';
import { fail } from './output.js';
import { SynodCliApp } from './core/app.js';

export async function runCli(argv = process.argv) {
  const app = new SynodCliApp();
  return app.run(argv);
}

export async function runCliOrExit(argv = process.argv) {
  try {
    const code = await runCli(argv);
    process.exitCode = code;
  } catch (err) {
    const exitCode = err instanceof CliError ? err.exitCode : EXIT.FAIL;
    const message = err instanceof Error ? err.message : String(err);
    fail(message);
    process.exit(exitCode);
  }
}
