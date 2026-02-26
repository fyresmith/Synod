import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

export async function writeCloudflaredConfig({
  configFile,
  tunnelId,
  credentialsFile,
  domain,
  port,
}) {
  await mkdir(dirname(configFile), { recursive: true });
  const yaml = `tunnel: ${tunnelId}\ncredentials-file: ${credentialsFile}\n\ningress:\n  - hostname: ${domain}\n    service: http://localhost:${port}\n\n  - service: http_status:404\n`;
  await writeFile(configFile, yaml, 'utf-8');
  return yaml;
}
