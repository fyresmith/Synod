import { registerSetupCommand } from './root/setupCmd.js';
import { registerSystemCommands } from './root/systemCmds.js';
import { registerDoctorCommand } from './root/doctorCmd.js';
import { registerRunCommand } from './root/runCmd.js';
import { registerDashboardCommand } from './root/dashboardCmd.js';
import { registerStatusCommand } from './root/statusCmd.js';

export function registerRootCommands(program) {
  registerSetupCommand(program);
  registerSystemCommands(program);
  registerDoctorCommand(program);
  registerRunCommand(program);
  registerDashboardCommand(program);
  registerStatusCommand(program);
}
