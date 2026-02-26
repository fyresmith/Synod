import { fileURLToPath } from 'url';
import { startSynodServer } from './server/index.js';

export { startSynodServer };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startSynodServer().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
