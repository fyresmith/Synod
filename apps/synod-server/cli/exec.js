import { execa } from 'execa';

export async function run(cmd, args = [], options = {}) {
  return execa(cmd, args, {
    stdio: options.stdio ?? 'pipe',
    ...options,
  });
}

export async function runInherit(cmd, args = [], options = {}) {
  return run(cmd, args, { ...options, stdio: 'inherit' });
}
