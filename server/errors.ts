import type { ApiErrorBody } from '../shared/types';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'server_error') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/** Strip anything that looks like a credential before a message reaches the client. */
export function redact(input: string): string {
  return input
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/"?(api[-_]?key|authorization)"?\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"');
}

export function toErrorPayload(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { message: redact(error.message), code: error.code, status: error.status } },
    };
  }
  if (error instanceof Error) {
    const isConfig = /not configured/i.test(error.message);
    const status = isConfig ? 503 : 500;
    return {
      status,
      body: {
        error: {
          message: redact(error.message) || 'Unexpected server error.',
          code: isConfig ? 'not_configured' : 'server_error',
          status,
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { message: 'Unexpected server error.', code: 'server_error', status: 500 } },
  };
}

/** Turn an upstream HTTP failure into a message the user can act on. */
export function mapProviderResponse(status: number, body: string): AppError {
  let upstream = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') upstream = parsed.error;
    else if (parsed.error && typeof parsed.error === 'object') upstream = parsed.error.message ?? '';
    else if (typeof parsed.message === 'string') upstream = parsed.message;
  } catch {
    upstream = body.slice(0, 400);
  }
  const detail = redact(upstream).replace(/\s+/g, ' ').trim();
  const suffix = detail ? ` Provider said: ${detail}` : '';

  if (status === 401 || status === 403) {
    return new AppError(
      `The provider rejected the credentials (${status}). Check AI_API_KEY / IMAGE_API_KEY, and that the key has access to this model. A "missing authentication header" reply means the running server has no usable key — set it, then restart the server.${suffix}`,
      401,
      'provider_auth',
    );
  }
  if (status === 404) {
    return new AppError(
      `The provider returned 404. Check AI_BASE_URL / IMAGE_BASE_URL and the model name.${suffix}`,
      502,
      'provider_not_found',
    );
  }
  if (status === 429) {
    return new AppError(
      `The provider is rate limiting or the account is out of quota (429). Wait a moment, then retry.${suffix}`,
      429,
      'provider_rate_limited',
    );
  }
  if (status >= 500) {
    return new AppError(
      `The provider failed with a ${status} error. Try again, or switch models in Settings.${suffix}`,
      502,
      'provider_error',
    );
  }
  return new AppError(
    `The provider rejected the request (${status}).${suffix}`,
    400,
    'provider_rejected',
  );
}

export function mapFetchError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError') {
    return new AppError('The request was cancelled.', 499, 'cancelled');
  }
  if (name === 'TimeoutError') {
    return new AppError(
      'The provider took too long to respond. Try a shorter request, a faster model, or retry.',
      504,
      'provider_timeout',
    );
  }
  const message = error instanceof Error ? error.message : 'Unknown network error';
  return new AppError(
    `Could not reach the provider (${redact(message)}). Check AI_BASE_URL and your network connection.`,
    502,
    'provider_unreachable',
  );
}
