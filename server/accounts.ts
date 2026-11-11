import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AccountSession, AccountStatus, AccountUser } from '../shared/types';
import { config } from './config';
import { AppError } from './errors';

/**
 * Accounts are local identities, not cloud accounts. This module keeps only
 * password hashes and hashed session tokens in the app's user-data folder so
 * the same sign-in survives app updates without sending anything anywhere.
 */

const FILE_VERSION = 1;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACCOUNTS = 20;
const MAX_DISPLAY_NAME = 40;
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,23}$/;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 8;

interface StoredAccount extends AccountUser {
  passwordHash: string;
  salt: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface AccountFile {
  version: number;
  accounts: StoredAccount[];
  sessions: StoredSession[];
}

const accountFile = path.join(config.dataDir, 'accounts.json');
const loginFailures = new Map<string, { count: number; first: number }>();

let cache: AccountFile | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();

function invalid(message: string, code = 'invalid_request'): never {
  throw new AppError(message, 400, code);
}

function normalUsername(value: unknown): string {
  if (typeof value !== 'string') invalid('Username is required.');
  const username = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    invalid('Use 3–24 characters: letters, numbers, dot, dash or underscore, starting with a letter or number.');
  }
  return username;
}

function validPassword(value: unknown, label = 'Password'): string {
  if (typeof value !== 'string') invalid(`${label} is required.`);
  if (value.length < 8) invalid(`${label} must be at least 8 characters.`);
  if (value.length > 128) invalid(`${label} must be 128 characters or fewer.`);
  return value;
}

function displayName(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') invalid('Display name must be text.');
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length > MAX_DISPLAY_NAME) invalid('Display name must be 40 characters or fewer.');
  return clean || fallback;
}

function publicUser(account: StoredAccount): AccountUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashPassword(password: string): Promise<{ salt: string; passwordHash: string }> {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt);
  return { salt, passwordHash: key.toString('base64') };
}

async function verifyPassword(password: string, account: StoredAccount): Promise<boolean> {
  const expected = Buffer.from(account.passwordHash, 'base64');
  const actual = await scrypt(password, account.salt);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function burnPasswordCheck(password: string): Promise<void> {
  await scrypt(password, 'movaryn-invalid-account-salt');
}

async function load(): Promise<AccountFile> {
  if (cache) return cache;

  await fsp.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(accountFile)) {
    cache = { version: FILE_VERSION, accounts: [], sessions: [] };
    return cache;
  }

  let parsed: AccountFile;
  try {
    parsed = JSON.parse(await fsp.readFile(accountFile, 'utf8')) as AccountFile;
  } catch {
    throw new AppError(
      `The accounts file could not be read. Check ${accountFile} and restore it from a backup.`,
      500,
      'accounts_unreadable',
    );
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.accounts)) {
    throw new AppError(
      `The accounts file has an unexpected format. Check ${accountFile}.`,
      500,
      'accounts_unreadable',
    );
  }
  if (Number(parsed.version) > FILE_VERSION) {
    throw new AppError(
      'This accounts file was written by a newer Movaryn version. Update the app to use it.',
      500,
      'accounts_version',
    );
  }

  cache = {
    version: FILE_VERSION,
    accounts: parsed.accounts.filter(
      (account): account is StoredAccount =>
        Boolean(
          account &&
            typeof account.id === 'string' &&
            typeof account.username === 'string' &&
            typeof account.passwordHash === 'string' &&
            typeof account.salt === 'string',
        ),
    ),
    sessions: Array.isArray(parsed.sessions)
      ? parsed.sessions.filter(
          (session): session is StoredSession =>
            Boolean(session && typeof session.tokenHash === 'string' && typeof session.userId === 'string'),
        )
      : [],
  };
  return cache;
}

async function save(next: AccountFile): Promise<void> {
  const now = Date.now();
  next.sessions = next.sessions.filter((session) => session.expiresAt > now);
  await fsp.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const temp = `${accountFile}.${process.pid}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temp, accountFile);
  try {
    await fsp.chmod(accountFile, 0o600);
  } catch {
    // Windows does not expose POSIX permissions; the file stays in the user profile.
  }
  cache = next;
}

function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function findAccountByToken(file: AccountFile, token: string): StoredAccount | null {
  const hash = tokenHash(token);
  const session = file.sessions.find((item) => item.tokenHash === hash && item.expiresAt > Date.now());
  if (!session) return null;
  return file.accounts.find((account) => account.id === session.userId) ?? null;
}

function newSession(file: AccountFile, userId: string): AccountSession {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  file.sessions.push({
    tokenHash: tokenHash(token),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_MS,
  });
  const account = file.accounts.find((item) => item.id === userId);
  if (!account) throw new AppError('Account not found.', 404, 'account_not_found');
  return { token, user: publicUser(account) };
}

function failureKey(username: string): string {
  return username.toLowerCase();
}

function checkFailureBudget(username: string): void {
  const entry = loginFailures.get(failureKey(username));
  if (!entry) return;
  if (Date.now() - entry.first > FAILURE_WINDOW_MS) {
    loginFailures.delete(failureKey(username));
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(
      'Too many failed sign-in attempts. Wait ten minutes and try again.',
      429,
      'login_throttled',
    );
  }
}

function recordFailure(username: string): void {
  const key = failureKey(username);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now - entry.first > FAILURE_WINDOW_MS) {
    loginFailures.set(key, { count: 1, first: now });
  } else {
    entry.count += 1;
  }
}

export async function getAccountStatus(token?: string): Promise<AccountStatus> {
  const file = await load();
  const account = token ? findAccountByToken(file, token) : null;
  return {
    enabled: true,
    hasAccounts: file.accounts.length > 0,
    user: account ? publicUser(account) : null,
  };
}

export async function registerAccount(input: {
  username: unknown;
  password: unknown;
  displayName?: unknown;
}): Promise<AccountSession> {
  const username = normalUsername(input.username);
  const password = validPassword(input.password);
  return mutate(async () => {
    const file = await load();
    if (file.accounts.length >= MAX_ACCOUNTS) {
      throw new AppError('This installation already has the maximum of 20 accounts.', 409, 'accounts_full');
    }
    if (file.accounts.some((account) => account.username === username)) {
      throw new AppError('That username is already taken on this installation.', 409, 'username_taken');
    }
    const now = Date.now();
    const hashed = await hashPassword(password);
    const account: StoredAccount = {
      id: `usr_${crypto.randomBytes(10).toString('hex')}`,
      username,
      displayName: displayName(input.displayName, username),
      createdAt: now,
      updatedAt: now,
      ...hashed,
    };
    file.accounts.push(account);
    const session = newSession(file, account.id);
    await save(file);
    loginFailures.delete(failureKey(username));
    return session;
  });
}

export async function loginAccount(input: {
  username: unknown;
  password: unknown;
}): Promise<AccountSession> {
  const username = normalUsername(input.username);
  if (typeof input.password !== 'string' || !input.password) invalid('Password is required.');
  if (input.password.length > 128) invalid('Password is too long.');
  checkFailureBudget(username);

  return mutate(async () => {
    const file = await load();
    const account = file.accounts.find((item) => item.username === username);
    if (!account) {
      await burnPasswordCheck(input.password as string);
      recordFailure(username);
      throw new AppError('That username or password is not correct.', 401, 'invalid_credentials');
    }
    if (!(await verifyPassword(input.password as string, account))) {
      recordFailure(username);
      throw new AppError('That username or password is not correct.', 401, 'invalid_credentials');
    }
    loginFailures.delete(failureKey(username));
    const session = newSession(file, account.id);
    await save(file);
    return session;
  });
}

export async function logoutAccount(token: string | undefined): Promise<void> {
  if (!token) return;
  await mutate(async () => {
    const file = await load();
    const hash = tokenHash(token);
    const before = file.sessions.length;
    file.sessions = file.sessions.filter((session) => session.tokenHash !== hash);
    if (file.sessions.length !== before) await save(file);
  });
}

export async function authenticateAccount(token: string | undefined): Promise<AccountUser | null> {
  if (!token) return null;
  const file = await load();
  const account = findAccountByToken(file, token);
  return account ? publicUser(account) : null;
}

export async function updateAccountProfile(
  token: string,
  input: { displayName?: unknown },
): Promise<AccountUser> {
  return mutate(async () => {
    const file = await load();
    const account = findAccountByToken(file, token);
    if (!account) throw new AppError('Sign in again to update this account.', 401, 'unauthorized');
    account.displayName = displayName(input.displayName, account.displayName);
    account.updatedAt = Date.now();
    await save(file);
    return publicUser(account);
  });
}

export async function changeAccountPassword(
  token: string,
  input: { currentPassword?: unknown; newPassword?: unknown },
): Promise<AccountSession> {
  if (typeof input.currentPassword !== 'string' || !input.currentPassword) {
    invalid('Current password is required.');
  }
  const nextPassword = validPassword(input.newPassword, 'New password');

  return mutate(async () => {
    const file = await load();
    const account = findAccountByToken(file, token);
    if (!account) throw new AppError('Sign in again to change this password.', 401, 'unauthorized');
    if (!(await verifyPassword(input.currentPassword as string, account))) {
      throw new AppError('The current password is not correct.', 401, 'invalid_credentials');
    }
    const hashed = await hashPassword(nextPassword);
    account.passwordHash = hashed.passwordHash;
    account.salt = hashed.salt;
    account.updatedAt = Date.now();
    // Rotate every session so a stolen token does not survive a password change.
    file.sessions = [];
    const session = newSession(file, account.id);
    await save(file);
    return session;
  });
}

export async function deleteAccount(
  token: string,
  input: { password?: unknown },
): Promise<void> {
  if (typeof input.password !== 'string' || !input.password) invalid('Password is required.');
  await mutate(async () => {
    const file = await load();
    const account = findAccountByToken(file, token);
    if (!account) throw new AppError('Sign in again to delete this account.', 401, 'unauthorized');
    if (!(await verifyPassword(input.password as string, account))) {
      throw new AppError('The password is not correct.', 401, 'invalid_credentials');
    }
    file.accounts = file.accounts.filter((item) => item.id !== account.id);
    file.sessions = file.sessions.filter((session) => session.userId !== account.id);
    await save(file);
  });
}
