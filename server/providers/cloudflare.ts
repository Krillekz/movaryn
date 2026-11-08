import type { AspectRatio, GeneratedImage, ImageRequest, ImageResponse } from '../../shared/types';
import { config } from '../config';
import { AppError, mapFetchError, redact } from '../errors';

/** FLUX.1 [schnell] accepts prompt and steps only; it always returns a square image. */
const FLUX_MODEL = /flux-1-schnell/i;

function dimensions(aspect: AspectRatio): { width: number; height: number } {
  if (config.image.size) {
    const [width, height] = config.image.size.split('x').map((value) => Number.parseInt(value, 10));
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
  }
  switch (aspect) {
    case '3:4':
    case '9:16':
      return { width: 768, height: 1024 };
    case '4:3':
    case '16:9':
      return { width: 1024, height: 768 };
    default:
      return { width: 1024, height: 1024 };
  }
}

function cloudflareError(status: number, body: string): AppError {
  let message = body;
  try {
    const json = JSON.parse(body) as { errors?: { message?: string }[] };
    const messages = (json.errors ?? [])
      .map((entry) => entry.message)
      .filter((entry): entry is string => Boolean(entry));
    if (messages.length > 0) message = messages.join('; ');
  } catch {
    // Not JSON; fall back to the raw body below.
  }

  if (status === 401 || status === 403) {
    return new AppError(
      'Cloudflare rejected the credentials. IMAGE_API_KEY must be an API token with Workers AI access, and IMAGE_ACCOUNT_ID must belong to that account.',
      502,
      'image_auth_failed',
    );
  }
  if (status === 429) {
    return new AppError(
      'Cloudflare rate limit or daily free allocation reached. The free plan allows 10,000 neurons per day, resetting at 00:00 UTC.',
      429,
      'rate_limited',
    );
  }
  return new AppError(
    `Cloudflare Workers AI error (${status}): ${redact(message).slice(0, 500) || 'no details returned'}`,
    502,
    'provider_error',
  );
}

function asDataUrl(base64: string): string {
  const cleaned = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  return `data:image/jpeg;base64,${cleaned}`;
}

/**
 * Calls the Workers AI REST endpoint. Cloudflare answers either with a JSON
 * envelope (`result.image` as base64) or raw image bytes, depending on model,
 * so both shapes are accepted.
 */
export async function generateCloudflareImage(input: ImageRequest): Promise<ImageResponse> {
  const model = (input.model || config.image.model).trim();
  const body: Record<string, unknown> = { prompt: input.prompt.slice(0, 2048) };
  if (FLUX_MODEL.test(model)) {
    // Four steps is the documented default and keeps the neuron cost low.
    body.steps = 4;
  } else {
    const { width, height } = dimensions(input.aspect);
    body.width = width;
    body.height = height;
  }

  const url = `${config.image.baseUrl}/accounts/${encodeURIComponent(config.image.accountId)}/ai/run/${model}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.image.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.image.timeoutMs),
    });
  } catch (error) {
    throw mapFetchError(error);
  }

  if (!response.ok) {
    let text = '';
    try {
      text = (await response.text()).slice(0, 4_000);
    } catch {
      text = '';
    }
    throw cloudflareError(response.status, text);
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  let images: GeneratedImage[];

  if (contentType.includes('application/json')) {
    const json = (await response.json().catch(() => null)) as any;
    if (json?.success === false) throw cloudflareError(502, JSON.stringify(json));
    const raw = json?.result?.image ?? json?.result?.images?.[0] ?? json?.image ?? null;
    if (typeof raw !== 'string' || !raw) {
      throw new AppError(
        'Cloudflare returned no image. Check IMAGE_MODEL (it must be an image model such as @cf/black-forest-labs/flux-1-schnell).',
        502,
        'no_image',
      );
    }
    images = [
      { id: `img-${Date.now()}-0`, dataUrl: asDataUrl(raw), aspect: input.aspect, prompt: input.prompt },
    ];
  } else {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new AppError('Cloudflare returned an empty image.', 502, 'no_image');
    }
    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
    images = [
      {
        id: `img-${Date.now()}-0`,
        dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
        aspect: input.aspect,
        prompt: input.prompt,
      },
    ];
  }

  return {
    images,
    model,
    ...(input.reference
      ? {
          notice:
            'Cloudflare image models do not accept a reference image, so this was generated from the written brief only.',
        }
      : {}),
  };
}
