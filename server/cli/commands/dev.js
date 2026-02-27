import { registerSeedCommand } from './dev/seedCmd.js';
import { registerSyncPluginCommand } from './dev/syncPluginCmd.js';
import { registerListCommand } from './dev/listCmd.js';

export function registerDevCommands(program) {
  const dev = program.command('dev').description('Developer environment utilities');
  registerSeedCommand(dev);
  registerSyncPluginCommand(dev);
  registerListCommand(dev);
}
