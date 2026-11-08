import type {
  AspectRatio,
  GeneratedImage,
  ImageQuality,
  ImageRequest,
  ImageResponse,
} from '../../shared/types';
import { config } from '../config';
import { AppError, mapFetchError, mapProviderResponse, redact } from '../errors';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface CompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function combinedSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function readError(response: Response): Promise<AppError> {
  let body = '';
  try {
    body = (await response.text()).slice(0, 4_000);
  } catch {
    body = '';
  }
  return mapProviderResponse(response.status, body);
}

/** Non-streaming completion, used for summaries. */
export async function complete(
  messages: ProviderMessage[],
  options: CompletionOptions,
): Promise<string> {
  const url = `${config.ai.baseUrl}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(config.ai.apiKey),
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: false,
        temperature: options.temperature ?? 0.3,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: combinedSignal(config.ai.timeoutMs, options.signal),
    });
  } catch (error) {
    throw mapFetchError(error);
  }

  if (!response.ok) throw await readError(response);

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new AppError('The provider returned a response that was not valid JSON.', 502, 'bad_response');
  }
  if (json?.error) {
    throw mapProviderResponse(400, JSON.stringify(json));
  }
  const content = extractMessageText(json);
  if (!content.trim()) {
    throw new AppError('The provider returned an empty response.', 502, 'empty_response');
  }
  return content;
}

function extractMessageText(json: any): string {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

export interface StreamResult {
  text: string;
  usage?: unknown;
}

/** Streams an assistant reply, calling onDelta for each text chunk. */
export async function streamCompletion(
  messages: ProviderMessage[],
  options: CompletionOptions,
  onDelta: (text: string) => void,
): Promise<StreamResult> {
  if (!config.ai.stream) {
    const text = await complete(messages, options);
    onDelta(text);
    return { text };
  }

  const url = `${config.ai.baseUrl}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(config.ai.apiKey),
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: combinedSignal(config.ai.timeoutMs, options.signal),
    });
  } catch (error) {
    throw mapFetchError(error);
  }

  if (!response.ok) throw await readError(response);
  if (!response.body) throw new AppError('The provider returned no response body.', 502, 'bad_response');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let usage: unknown;
  let finished = false;

  const handleLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return;
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.replace(/^data:\s*/, '');
    if (!payload || payload === '[DONE]') {
      finished = true;
      return;
    }
    let json: any;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    if (json?.error) {
      throw mapProviderResponse(400, JSON.stringify(json));
    }
    if (json?.usage) usage = json.usage;
    const choice = json?.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.text ?? choice?.message?.content;
    if (typeof delta === 'string' && delta) {
      text += delta;
      onDelta(delta);
    }
    if (choice?.finish_reason) finished = true;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        handleLine(line);
        newline = buffer.indexOf('\n');
      }
      if (finished) break;
    }
    if (buffer.trim()) handleLine(buffer);
  } catch (error) {
    throw mapFetchError(error);
  } finally {
    reader.cancel().catch(() => undefined);
  }

  if (!text.trim()) {
    throw new AppError(
      'The provider returned an empty response. Try again, or check AI_MODEL and that the model supports chat completions.',
      502,
      'empty_response',
    );
  }
  return { text, usage };
}

/** Aspect ratio to a provider size, with IMAGE_SIZE as an override. */
export function resolveImageSize(aspect: AspectRatio, model: string): string {
  if (config.image.size) return config.image.size;
  if (/dall-e-3|dalle-3/i.test(model)) {
    return aspect === '1:1' ? '1024x1024' : aspect === '3:4' || aspect === '9:16' ? '1024x1792' : '1792x1024';
  }
  if (/dall-e-2|dalle-2/i.test(model)) return '1024x1024';
  switch (aspect) {
    case '3:4':
    case '9:16':
      return '1024x1536';
    case '4:3':
    case '16:9':
      return '1536x1024';
    default:
      return '1024x1024';
  }
}

function parseImageResponse(
  json: any,
  prompt: string,
  aspect: AspectRatio,
): GeneratedImage[] {
  const items: any[] = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.images)
      ? json.images
      : Array.isArray(json?.output)
        ? json.output
        : [];
  const images: GeneratedImage[] = [];

  items.forEach((item: any, index: number) => {
    if (typeof item === 'string') {
      if (/^https?:\/\//.test(item)) {
        images.push({ id: `img-${index}`, url: item, aspect, prompt });
      } else if (item.startsWith('data:image/')) {
        images.push({ id: `img-${index}`, dataUrl: item, aspect, prompt });
      }
      return;
    }
    const base64 = item?.b64_json ?? item?.b64 ?? item?.image_base64 ?? item?.base64;
    const url = item?.url ?? item?.image_url;
    if (typeof base64 === 'string' && base64) {
      const dataUrl = base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`;
      images.push({ id: `img-${index}`, dataUrl, aspect, prompt });
    } else if (typeof url === 'string' && url) {
      images.push({ id: `img-${index}`, url, aspect, prompt });
    }
    if (typeof item?.revised_prompt === 'string' && images.length > 0) {
      images[images.length - 1].revisedPrompt = redact(item.revised_prompt).slice(0, 1_500);
    }
  });

  if (images.length === 0) {
    throw new AppError(
      'The image provider returned no images. Check IMAGE_MODEL (it must be an image model), IMAGE_BASE_URL, and that your account has image access enabled.',
      502,
      'no_image',
    );
  }
  return images.map((image, index) => ({ ...image, id: `img-${Date.now()}-${index}` }));
}

function buildImageBody(prompt: string, aspect: AspectRatio, model: string, quality: ImageQuality) {
  const size = resolveImageSize(aspect, model);
  const body: Record<string, unknown> = { model, prompt, n: 1, size };
  if (config.image.quality) body.quality = config.image.quality;
  else if (quality) body.quality = quality;
  return body;
}

async function decodeReference(
  reference: NonNullable<ImageRequest['reference']>,
): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const match = reference.dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new AppError('The reference image could not be decoded.', 400, 'bad_reference');
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const filename = reference.name && /\.[a-z0-9]+$/i.test(reference.name)
    ? reference.name
    : `reference.${extension}`;
  return { buffer, mime, filename };
}

async function requestImageEdit(
  input: ImageRequest,
  reference: NonNullable<ImageRequest['reference']>,
  model: string,
): Promise<{ images: GeneratedImage[]; model: string }> {
  const { buffer, mime, filename } = await decodeReference(reference);
  const size = resolveImageSize(input.aspect, model);
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', input.prompt);
  form.set('n', '1');
  form.set('size', size);
  if (config.image.quality) form.set('quality', config.image.quality);
  else if (input.quality) form.set('quality', input.quality);
  form.set('image', new Blob([Uint8Array.from(buffer)], { type: mime }), filename);

  let response: Response;
  try {
    response = await fetch(`${config.image.baseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.image.apiKey}` },
      body: form,
      signal: combinedSignal(config.image.timeoutMs),
    });
  } catch (error) {
    throw mapFetchError(error);
  }
  if (!response.ok) {
    const mapped = await readError(response);
    // Preserve the upstream status so a provider without /images/edits can
    // fall back to generation instead of failing the whole request.
    if ([400, 404, 405, 415, 422].includes(response.status)) {
      throw new AppError(mapped.message, response.status, 'image_edit_unsupported');
    }
    throw mapped;
  }

  const json: any = await response.json().catch(() => null);
  if (json?.error) throw mapProviderResponse(400, JSON.stringify(json));
  return {
    images: parseImageResponse(json, input.prompt, input.aspect),
    model,
  };
}

/**
 * Generates concept art. When a reference image is supplied and the provider
 * supports it, the reference conditions the result; otherwise the written
 * brief is used and the response says so.
 */
export async function generateOpenAIImage(input: ImageRequest): Promise<ImageResponse> {
  const model = (input.model || config.image.model).trim();
  const reference = input.reference ?? null;

  if (reference) {
    if (!config.image.reference) {
      const fallback = await requestImageGeneration(input, model);
      return {
        ...fallback,
        notice:
          'Reference conditioning is disabled (IMAGE_REFERENCE=false), so this image was generated from the written brief only.',
      };
    }
    try {
      const edited = await requestImageEdit(input, reference, model);
      return { ...edited };
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      if (![400, 404, 405, 415, 422].includes(status)) throw error;
      const fallback = await requestImageGeneration(input, model);
      return {
        ...fallback,
        notice:
          'The image provider could not use the reference image, so this was generated from the written brief only. ' +
          'Set IMAGE_REFERENCE=false to skip reference attempts, or use a provider that supports image edits.',
      };
    }
  }

  return requestImageGeneration(input, model);
}

async function requestImageGeneration(
  input: ImageRequest,
  model: string,
): Promise<{ images: GeneratedImage[]; model: string }> {
  let response: Response;
  try {
    response = await fetch(`${config.image.baseUrl}/images/generations`, {
      method: 'POST',
      headers: authHeaders(config.image.apiKey),
      body: JSON.stringify(buildImageBody(input.prompt, input.aspect, model, input.quality ?? '')),
      signal: combinedSignal(config.image.timeoutMs),
    });
  } catch (error) {
    throw mapFetchError(error);
  }

  if (!response.ok) throw await readError(response);
  const json: any = await response.json().catch(() => null);
  if (json?.error) throw mapProviderResponse(400, JSON.stringify(json));
  return { images: parseImageResponse(json, input.prompt, input.aspect), model };
}
