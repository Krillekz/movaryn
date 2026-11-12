import type {
  AccountCredentialRecord,
  AccountSession,
  AccountStatus,
  AccountUser,
} from '../../shared/types';
import { apiBase } from './apiBase';
import { ApiError } from './api';

const TOKEN_KEY = 'movaryn.account.token';

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A blocked storage write only means the session ends with this window.
  }
}

let token = readToken();

async function readError(response: Response): Promise<ApiError> {
  let message = `The account service returned ${response.status}.`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } };
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
  } catch {
    // keep the generic message
  }
  return new ApiError(message, code, response.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      apiBase
        ? `The Movaryn API at ${apiBase} is not reachable. Check that it is running.`
        : 'The Movaryn API is not reachable. Start it with "npm run dev", then retry.',
      'offline',
    );
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function remember(session: AccountSession): AccountSession {
  token = session.token;
  writeToken(token);
  return session;
}

export async function loadAccountStatus(): Promise<AccountStatus> {
  const status = await request<AccountStatus>('/api/auth/status');
  if (token && !status.user) {
    token = null;
    writeToken(null);
  }
  return status;
}

export async function registerLocalAccount(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AccountSession> {
  return remember(
    await request<AccountSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function loginLocalAccount(input: {
  username: string;
  password: string;
}): Promise<AccountSession> {
  return remember(
    await request<AccountSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function logoutLocalAccount(): Promise<void> {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' });
  } finally {
    token = null;
    writeToken(null);
  }
}

export async function updateLocalAccount(displayName: string): Promise<AccountUser> {
  const result = await request<{ user: AccountUser }>('/api/account', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  return result.user;
}

export async function changeLocalPassword(
  currentPassword: string,
  newPassword: string,
): Promise<AccountSession> {
  return remember(
    await request<AccountSession>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}

export async function exportLocalAccount(password: string): Promise<AccountCredentialRecord> {
  const result = await request<{ account: AccountCredentialRecord }>('/api/account/backup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return result.account;
}

export async function isLocalUsernameAvailable(username: string): Promise<boolean> {
  const result = await request<{ available: boolean }>('/api/account/restore-check', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  return result.available;
}

export async function importLocalAccount(
  account: AccountCredentialRecord,
): Promise<AccountSession> {
  return remember(
    await request<AccountSession>('/api/account/restore', {
      method: 'POST',
      body: JSON.stringify({ account }),
    }),
  );
}

export async function deleteLocalAccount(password: string): Promise<void> {
  try {
    await request<void>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  } finally {
    token = null;
    writeToken(null);
  }
}
