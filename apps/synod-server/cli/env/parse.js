import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function loadEnvFile(envFile) {
  if (!existsSync(envFile)) return {};
  const raw = await readFile(envFile, 'utf-8');
  return dotenv.parse(raw);
}
