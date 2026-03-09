import { describe, it, expect } from 'vitest';
import { isAllowed, isDenied } from '../../lib/vault/policy.js';

describe('isAllowed', () => {
  it('allows .md files', () => {
    expect(isAllowed('notes/hello.md')).toBe(true);
  });

  it('allows .canvas files', () => {
    expect(isAllowed('diagrams/flow.canvas')).toBe(true);
  });

  it('denies .js files', () => {
    expect(isAllowed('scripts/app.js')).toBe(false);
  });

  it('denies .json files', () => {
    expect(isAllowed('config.json')).toBe(false);
  });

  it('denies .obsidian/ paths', () => {
    expect(isAllowed('.obsidian/app.json')).toBe(false);
  });

  it('denies .git/ paths', () => {
    expect(isAllowed('.git/config')).toBe(false);
  });

  it('denies .DS_Store', () => {
    expect(isAllowed('.DS_Store')).toBe(false);
  });

  it('denies .synod/ paths', () => {
    expect(isAllowed('.synod/managed-state.json')).toBe(false);
  });
});

describe('isDenied', () => {
  it('denies exact .obsidian match', () => {
    expect(isDenied('.obsidian')).toBe(true);
  });

  it('denies .obsidian/nested path', () => {
    expect(isDenied('.obsidian/workspace.json')).toBe(true);
  });

  it('denies .git path', () => {
    expect(isDenied('.git/HEAD')).toBe(true);
  });

  it('denies .synod-quarantine prefix', () => {
    expect(isDenied('.synod-quarantine/file.md')).toBe(true);
  });

  it('denies .DS_Store', () => {
    expect(isDenied('.DS_Store')).toBe(true);
  });

  it('denies Thumbs.db', () => {
    expect(isDenied('Thumbs.db')).toBe(true);
  });

  it('denies Attachments prefix', () => {
    expect(isDenied('Attachments/photo.png')).toBe(true);
  });

  it('does not deny a regular md file', () => {
    expect(isDenied('notes/hello.md')).toBe(false);
  });

  it('does not deny a path that merely starts with a deny word but is not the prefix', () => {
    expect(isDenied('my-obsidian-notes/file.md')).toBe(false);
  });
});
