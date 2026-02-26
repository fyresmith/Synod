import { resolveContext } from '../../core/context.js';
import { runDoctorChecks } from '../../flows/doctor.js';

export function registerDoctorCommand(program) {
  program
    .command('doctor')
    .description('Run prerequisite and configuration checks')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      await runDoctorChecks({ envFile, includeCloudflared: true });
    });
}
