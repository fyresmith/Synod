import process from 'process';
import { createRequire } from 'module';
import { Command, CommanderError } from 'commander';
import { EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { registerEnvCommands } from '../commands/env.js';
import { registerManagedCommands } from '../commands/managed.js';
import { registerRootCommands } from '../commands/root.js';
import { registerServiceCommands } from '../commands/service.js';
import { registerTunnelCommands } from '../commands/tunnel.js';
import { registerDevCommands } from '../commands/dev.js';

const require = createRequire(import.meta.url);
const { version: cliVersion } = require('../../package.json');

export class SynodCliApp {
  constructor() {
    this.program = this.createProgram();
  }

  createProgram() {
    const program = new Command();

    program
      .name('synod')
      .description('Synod server operations CLI')
      .showHelpAfterError()
      .version(cliVersion, '-v, --version', 'output the version number');

    registerRootCommands(program);
    registerEnvCommands(program);
    registerManagedCommands(program);
    registerTunnelCommands(program);
    registerServiceCommands(program);
    registerDevCommands(program);

    return program;
  }

  async run(argv = process.argv) {
    if ((argv?.length ?? 0) <= 2) {
      this.program.outputHelp();
      return EXIT.OK;
    }

    const normalizedArgv = argv.map((arg) => (arg === '-V' ? '-v' : arg));

    this.program.exitOverride();

    try {
      await this.program.parseAsync(normalizedArgv);
      return EXIT.OK;
    } catch (err) {
      if (err instanceof CommanderError) {
        if (
          err.code === 'commander.helpDisplayed' ||
          err.code === 'commander.version' ||
          err.code === 'commander.versionDisplayed' ||
          err.code === 'commander.help' ||
          err.message === '(outputHelp)'
        ) {
          return EXIT.OK;
        }
        throw new CliError(err.message, err.exitCode ?? EXIT.FAIL);
      }
      throw err;
    }
  }
}
