import { randomUUID, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);

const STATE_VERSION = 1;
const STATE_REL_PATH = join('.synod', 'accounts-state.json');

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseEmail(value) {
  const email = String(value ?? '').trim();
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !emailNorm.includes('@')) {
    throw new Error('A valid email is required');
  }
  return { email, emailNorm };
}

function normalizeDisplayName(value) {
  const displayName = String(value ?? '').trim();
  if (!displayName || displayName.length > 32) {
    throw new Error('Display name must be 1-32 characters');
  }
  return displayName;
}

function normalizeAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const email = String(raw.email ?? '').trim();
  const emailNorm = normalizeEmail(raw.emailNorm ?? email);
  const displayName = String(raw.displayName ?? '').trim();
  const passwordHash = String(raw.passwordHash ?? '').trim();
  const passwordSalt = String(raw.passwordSalt ?? '').trim();
  const createdAt = String(raw.createdAt ?? '').trim();
  const updatedAt = String(raw.updatedAt ?? '').trim();

  if (!id || !emailNorm || !displayName || !passwordHash || !passwordSalt || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    email,
    emailNorm,
    displayName,
    passwordHash,
    passwordSalt,
    createdAt,
    updatedAt,
  };
}

function normalizeState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const accountsRaw = source.accounts && typeof source.accounts === 'object' ? source.accounts : {};

  const accounts = {};
  for (const [id, value] of Object.entries(accountsRaw)) {
    const normalized = normalizeAccount(value);
    if (normalized) {
      accounts[id] = normalized;
    }
  }

  return {
    version: STATE_VERSION,
    accounts,
  };
}

async function hashPassword(password, salt) {
  const input = String(password ?? '');
  if (input.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const derived = await scrypt(input, salt, 64);
  return Buffer.from(derived).toString('hex');
}

export function getAccountsStatePath(vaultPath) {
  return join(resolve(vaultPath), STATE_REL_PATH);
}

export async function loadAccountsState(vaultPath) {
  const filePath = getAccountsStatePath(vaultPath);
  if (!existsSync(filePath)) {
    return normalizeState(null);
  }
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return normalizeState(parsed);
}

export async function saveAccountsState(vaultPath, state) {
  const filePath = getAccountsStatePath(vaultPath);
  const normalized = normalizeState(state);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
  return normalized;
}

export async function createAccount({ vaultPath, email, password, displayName }) {
  const { emailNorm } = parseEmail(email);
  const nextDisplayName = normalizeDisplayName(displayName);

  const state = await loadAccountsState(vaultPath);
  const existing = Object.values(state.accounts).find((row) => row.emailNorm === emailNorm);
  if (existing) {
    throw new Error('An account already exists for this email');
  }

  const id = randomUUID();
  const passwordSalt = randomUUID();
  const passwordHash = await hashPassword(password, passwordSalt);
  const ts = nowIso();

  state.accounts[id] = {
    id,
    email: String(email ?? '').trim(),
    emailNorm,
    displayName: nextDisplayName,
    passwordHash,
    passwordSalt,
    createdAt: ts,
    updatedAt: ts,
  };

  await saveAccountsState(vaultPath, state);
  return toPublicAccount(state.accounts[id]);
}

export async function createOwnerAccount({ vaultPath, email, displayName, password }) {
  return createAccount({
    vaultPath,
    email,
    password,
    displayName,
  });
}

export async function authenticateAccount({ vaultPath, email, password }) {
  const { emailNorm } = parseEmail(email);
  const state = await loadAccountsState(vaultPath);
  const account = Object.values(state.accounts).find((row) => row.emailNorm === emailNorm);
  if (!account) {
    throw new Error('Invalid email or password');
  }

  const derived = await hashPassword(password, account.passwordSalt);
  const actual = Buffer.from(account.passwordHash, 'hex');
  const incoming = Buffer.from(derived, 'hex');
  if (actual.length !== incoming.length || !timingSafeEqual(actual, incoming)) {
    throw new Error('Invalid email or password');
  }

  return toPublicAccount(account);
}

export async function getAccountById(vaultPath, accountId) {
  const id = String(accountId ?? '').trim();
  if (!id) return null;

  const state = await loadAccountsState(vaultPath);
  const account = state.accounts[id];
  if (!account) return null;
  return toPublicAccount(account);
}

export function toPublicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    emailNorm: account.emailNorm,
    displayName: account.displayName,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
