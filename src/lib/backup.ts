import type { AccountCredentialRecord } from '../../shared/types';
import { APP_VERSION } from './appVersion';
import type { WorkspaceSnapshot } from './db';

const FORMAT = 'movaryn-account-backup';
const VERSION = 1;
const ITERATIONS = 210_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;

export interface BackupDocument {
  format: typeof FORMAT;
  version: typeof VERSION;
  appVersion: string;
  exportedAt: string;
  account: AccountCredentialRecord;
  workspace: WorkspaceSnapshot;
}

export interface EncryptedBackupDocument {
  format: typeof FORMAT;
  version: typeof VERSION;
  encrypted: true;
  appVersion: string;
  exportedAt: string;
  encryption: {
    algorithm: 'AES-GCM';
    kdf: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
    iv: string;
  };
  payload: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot encrypt backups. Use the desktop app or a current browser.');
  }
  return globalThis.crypto.subtle;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertRecords(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`The backup's ${label} are not valid.`);
  }
}

function validateBackup(value: unknown): BackupDocument {
  if (!isRecord(value) || value.format !== FORMAT || value.version !== VERSION) {
    throw new Error('This is not a Movaryn account backup.');
  }
  const account = value.account;
  if (
    !isRecord(account) ||
    typeof account.username !== 'string' ||
    typeof account.passwordHash !== 'string' ||
    typeof account.salt !== 'string'
  ) {
    throw new Error('The backup does not contain a valid account.');
  }
  const workspace = value.workspace;
  if (!isRecord(workspace)) throw new Error('The backup does not contain a workspace.');
  assertRecords(workspace.conversations, 'chats');
  assertRecords(workspace.projects, 'projects');
  assertRecords(workspace.notebooks, 'notebooks');
  assertRecords(workspace.versions, 'versions');
  assertRecords(workspace.research, 'research entries');
  return value as unknown as BackupDocument;
}

export async function encryptBackup(
  account: AccountCredentialRecord,
  workspace: WorkspaceSnapshot,
  passphrase: string,
): Promise<EncryptedBackupDocument> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const document: BackupDocument = {
    format: FORMAT,
    version: VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    account,
    workspace,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(document));
  const encrypted = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    format: FORMAT,
    version: VERSION,
    encrypted: true,
    appVersion: APP_VERSION,
    exportedAt: document.exportedAt,
    encryption: {
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations: ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackup(
  raw: unknown,
  passphrase: string,
): Promise<BackupDocument> {
  if (!isRecord(raw) || raw.format !== FORMAT || raw.version !== VERSION || raw.encrypted !== true) {
    throw new Error('This is not a Movaryn account backup.');
  }
  const encryption = raw.encryption;
  if (
    !isRecord(encryption) ||
    encryption.algorithm !== 'AES-GCM' ||
    encryption.kdf !== 'PBKDF2' ||
    encryption.hash !== 'SHA-256' ||
    typeof encryption.iterations !== 'number' ||
    encryption.iterations < MIN_ITERATIONS ||
    encryption.iterations > MAX_ITERATIONS ||
    typeof encryption.salt !== 'string' ||
    typeof encryption.iv !== 'string' ||
    typeof raw.payload !== 'string'
  ) {
    throw new Error('The backup encryption settings are not supported.');
  }

  let plaintext: ArrayBuffer;
  try {
    const key = await deriveKey(
      passphrase,
      base64ToBytes(encryption.salt),
      encryption.iterations,
    );
    plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(encryption.iv) },
      key,
      base64ToBytes(raw.payload),
    );
  } catch {
    throw new Error('That passphrase did not unlock this backup.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error('The backup contents are damaged.');
  }
  return validateBackup(parsed);
}
