import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('safePath', () => {
  const originalVaultPath = process.env.VAULT_PATH;

  beforeEach(() => {
    // Reset module state between tests by clearing the vault root cache
    process.env.VAULT_PATH = '/tmp/test-vault';
  });

  afterEach(() => {
    process.env.VAULT_PATH = originalVaultPath;
  });

  it('returns absolute path for a valid relative path', async () => {
    const { safePath } = await import('../../lib/vault/paths.js');
    const result = safePath('notes/hello.md');
    expect(result).toBe('/tmp/test-vault/notes/hello.md');
  });

  it('throws on directory traversal with ../', async () => {
    const { safePath } = await import('../../lib/vault/paths.js');
    expect(() => safePath('../outside.txt')).toThrow('Path traversal');
  });

  it('throws on deep traversal ../../etc/passwd', async () => {
    const { safePath } = await import('../../lib/vault/paths.js');
    expect(() => safePath('../../etc/passwd')).toThrow('Path traversal');
  });

  it('throws on traversal disguised within a valid-looking path', async () => {
    const { safePath } = await import('../../lib/vault/paths.js');
    expect(() => safePath('notes/../../etc/shadow')).toThrow('Path traversal');
  });
});
