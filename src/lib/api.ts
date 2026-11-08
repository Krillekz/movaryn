import type {
  ChatRequest,
  ImageRequest,
  ImageResponse,
  ProviderStatus,
  SummaryRequest,
} from '../../shared/types';

const rawBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const apiBase = rawBase;

function apiUrl(path: string): string {
  return `${rawBase}${path}`;
}

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function readError(response: Response): Promise<ApiError> {
  let message = `The API returned ${response.status}.`;
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

export async function fetchHealth(signal?: AbortSignal): Promise<ProviderStatus> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/health'), { signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(
      'The Movaryn API is not reachable. Start it with "npm run dev", or point VITE_API_BASE_URL at your deployed API.',
      'offline',
    );
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ProviderStatus;
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(body: ChatRequest, handlers: StreamHandlers): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the Movaryn API. Make sure the API server is running (npm run dev), then retry.',
      'network',
    );
  }

  if (!response.ok) throw await readError(response);
  if (!response.body) throw new ApiError('The API returned no response stream.', 'no_stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
        if (dataLine) {
          const payload = dataLine.slice(5).trim();
          if (payload) {
            let event: any;
            try {
              event = JSON.parse(payload);
            } catch {
              event = null;
            }
            if (event?.type === 'delta' && typeof event.text === 'string') {
              handlers.onDelta(event.text);
            } else if (event?.type === 'error') {
              throw new ApiError(event.message || 'The provider returned an error.', event.code);
            } else if (event?.type === 'done') {
              completed = true;
              break;
            }
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

export async function requestImage(body: ImageRequest): Promise<ImageResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the image service. Check that the API is running.', 'network');
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ImageResponse;
}

export async function requestSummary(body: SummaryRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/summarize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the summarizer.', 'network');
  }
  if (!response.ok) throw await readError(response);
  const data = (await response.json()) as { summary?: string };
  return (data.summary ?? '').trim();
}
