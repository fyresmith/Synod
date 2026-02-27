import process from 'process';
import { Command, CommanderError } from 'commander';
import { EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { registerEnvCommands } from '../commands/env.js';
import { registerManagedCommands } from '../commands/managed.js';
import { registerRootCommands } from '../commands/root.js';
import { registerServiceCommands } from '../commands/service.js';
import { registerTunnelCommands } from '../commands/tunnel.js';
import { registerDevCommands } from '../commands/dev.js';

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
      .version('1.0.0');

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

    this.program.exitOverride();

    try {
      await this.program.parseAsync(argv);
      return EXIT.OK;
    } catch (err) {
      if (err instanceof CommanderError) {
        if (
          err.code === 'commander.helpDisplayed'
          || err.code === 'commander.help'
          || err.message === '(outputHelp)'
        ) {
          return EXIT.OK;
        }
        throw new CliError(err.message, err.exitCode ?? EXIT.FAIL);
      }
      throw err;
    }
  }
}
