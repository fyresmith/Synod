import prompts from 'prompts';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { CliError } from '../errors.js';
import { normalizeEnv, serializeEnv } from './normalize.js';

export async function writeEnvFile(envFile, values) {
  await mkdir(dirname(envFile), { recursive: true });
  await writeFile(envFile, serializeEnv(normalizeEnv(values)), 'utf-8');
}

export async function promptForEnv({ envFile, existing, yes = false, preset = {} }) {
  const base = { ...existing, ...preset };

  if (!String(base.JWT_SECRET ?? '').trim()) {
    base.JWT_SECRET = randomBytes(32).toString('hex');
  }

  const current = normalizeEnv(base);

  if (yes) {
    await writeEnvFile(envFile, current);
    return current;
  }

  const questions = [
    { name: 'PORT', message: 'HTTP port' },
  ];

  const answers = {};
  for (const q of questions) {
    const response = await prompts({
      type: 'text',
      name: 'value',
      message: q.message,
      initial: current[q.name] ?? '',
    });
    if (response.value === undefined) {
      throw new CliError('Cancelled by user');
    }
    answers[q.name] = String(response.value ?? '').trim();
  }

  const merged = normalizeEnv({ ...current, ...answers });
  await writeEnvFile(envFile, merged);
  return merged;
}
