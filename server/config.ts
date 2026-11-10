import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Load provider credentials from an env file. Values already present in
 * process.env win, which lets the Electron main process pass a user-data
 * env file without the file being copied into the app bundle.
 */
function loadEnvFiles(): void {
  const candidates = [process.env.MOVARYN_ENV_FILE, path.join(process.cwd(), '.env')];
  for (const file of candidates) {
    if (file && fs.existsSync(file)) {
      dotenv.config({ path: file });
    }
  }
}
loadEnvFiles();

const text = (value: string | undefined): string => (value ?? '').trim();
const stripSlash = (value: string): string => value.trim().replace(/\/+$/, '');

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(text(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const aiBaseUrl = stripSlash(text(process.env.AI_BASE_URL)) || 'https://api.openai.com/v1';
const aiApiKey = text(process.env.AI_API_KEY);
const aiModel = text(process.env.AI_MODEL) || 'gpt-4.1-mini';

/** Cloudflare Workers AI is not OpenAI-shaped, so it gets its own call path. */
export type ImageProvider = 'openai' | 'cloudflare';

const imageAccountId =
  text(process.env.IMAGE_ACCOUNT_ID) || text(process.env.CLOUDFLARE_ACCOUNT_ID);
const requestedImageProvider = text(process.env.IMAGE_PROVIDER).toLowerCase();
const imageProvider: ImageProvider =
  requestedImageProvider === 'cloudflare' || requestedImageProvider === 'openai'
    ? requestedImageProvider
    : imageAccountId
      ? 'cloudflare'
      : 'openai';
const isCloudflare = imageProvider === 'cloudflare';

const imageBaseUrl =
  stripSlash(text(process.env.IMAGE_BASE_URL)) ||
  (isCloudflare ? 'https://api.cloudflare.com/client/v4' : aiBaseUrl);
// Cloudflare must never borrow AI_API_KEY: a chat key from another provider is
// rejected upstream with a confusing 401 ("Missing Authentication header")
// instead of the honest "not configured" the app should show.
const imageApiKey = isCloudflare
  ? text(process.env.IMAGE_API_KEY) || text(process.env.CLOUDFLARE_API_TOKEN)
  : text(process.env.IMAGE_API_KEY) || aiApiKey;
// No default for OpenAI-shaped hosts: falling back to gpt-image-1 marked images
// as configured on hosts that only serve chat completions, so the app offered a
// button that could only fail. Cloudflare has a documented free image model.
const imageModel =
  text(process.env.IMAGE_MODEL) || (isCloudflare ? '@cf/black-forest-labs/flux-1-schnell' : '');

const imageSize = text(process.env.IMAGE_SIZE);

/**
 * Port 0 (a random free port) is only allowed when the desktop shell asks for
 * it, because hosting environments sometimes export PORT=0 and the browser dev
 * proxy expects 8787.
 */
function resolvePort(): number {
  if (bool(process.env.MOVARYN_RANDOM_PORT, false)) return 0;
  const parsed = Number.parseInt(text(process.env.PORT), 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65_535) return parsed;
  return 8787;
}

/** Package version, so the About panel and health check match the shipped build. */
function readPackageVersion(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(__dirname, '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'movaryn' && pkg.version) return pkg.version;
    } catch {
      // try the next location
    }
  }
  return '0.0.0';
}

export const config = {
  version: readPackageVersion(),
  host: text(process.env.HOST) || '127.0.0.1',
  port: resolvePort(),
  ai: {
    baseUrl: aiBaseUrl,
    apiKey: aiApiKey,
    model: aiModel,
    stream: bool(process.env.AI_STREAM, true),
    vision: bool(process.env.AI_VISION, true),
    timeoutMs: integer(process.env.AI_TIMEOUT_MS, 180_000, 10_000, 900_000),
    // Opt-in per request, but a host can switch the lookup off entirely.
    research: bool(process.env.AI_RESEARCH, true),
    configured: aiApiKey.length > 0 && aiModel.length > 0 && validHttpUrl(aiBaseUrl),
  },
  image: {
    provider: imageProvider,
    accountId: imageAccountId,
    baseUrl: imageBaseUrl,
    apiKey: imageApiKey,
    model: imageModel,
    quality: (text(process.env.IMAGE_QUALITY) as string).toLowerCase(),
    size: /^\d{3,4}x\d{3,4}$/.test(imageSize) ? imageSize : '',
    // Workers AI image models here cannot condition on an uploaded reference.
    reference: isCloudflare ? false : bool(process.env.IMAGE_REFERENCE, true),
    timeoutMs: integer(process.env.IMAGE_TIMEOUT_MS, 240_000, 10_000, 900_000),
    configured:
      imageApiKey.length > 0 &&
      imageModel.length > 0 &&
      validHttpUrl(imageBaseUrl) &&
      (!isCloudflare || imageAccountId.length > 0),
  },
  allowedOrigins: text(process.env.ALLOWED_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  staticDir: text(process.env.MOVARYN_STATIC_DIR),
  maxBodyMb: integer(process.env.MAX_BODY_MB, 20, 1, 64),
  rateLimitPerMinute: integer(process.env.RATE_LIMIT_PER_MINUTE, 45, 1, 10_000),
  trustProxy: bool(process.env.TRUST_PROXY, false),
};

/** Host shown in the app; never includes credentials. */
export function endpointHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Missing settings, by name only — values are never returned. */
export function setupChecklist(): string[] {
  const missing: string[] = [];
  if (!aiApiKey) missing.push('AI_API_KEY');
  if (!validHttpUrl(aiBaseUrl)) missing.push('AI_BASE_URL');
  if (!aiModel) missing.push('AI_MODEL');
  if (!imageApiKey) {
    missing.push(isCloudflare ? 'IMAGE_API_KEY (or CLOUDFLARE_API_TOKEN)' : 'IMAGE_API_KEY (or AI_API_KEY)');
  }
  if (isCloudflare) {
    if (!imageAccountId) missing.push('IMAGE_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID)');
  } else if (!imageModel) {
    missing.push('IMAGE_MODEL');
  }
  return missing;
}

export function requireChatConfigured(): void {
  if (!config.ai.configured) {
    throw new Error(
      'The AI provider is not configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL to .env, then restart the server.',
    );
  }
}

export function requireImageConfigured(): void {
  if (!config.image.configured) {
    throw new Error(
      isCloudflare
        ? 'The image provider is not configured. Add IMAGE_API_KEY (a Cloudflare API token with Workers AI access) and IMAGE_ACCOUNT_ID to .env, then restart the server.'
        : 'The image provider is not configured. Add IMAGE_API_KEY and IMAGE_MODEL to .env, then restart the server.',
    );
  }
}
