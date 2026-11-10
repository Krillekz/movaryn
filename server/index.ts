import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  ChatRequest,
  ImageResponse,
  ProviderStatus,
} from '../shared/types';
import { buildSystemPrompt, SUMMARY_INSTRUCTION, SUMMARIZER_SYSTEM_PROMPT } from '../shared/systemPrompt';
import { config, endpointHost, setupChecklist } from './config';
import { AppError, toErrorPayload } from './errors';
import { complete, streamCompletion, type ContentPart, type ProviderMessage } from './providers/openai';
import { generateImage } from './providers/images';
import {
  validateChatRequest,
  validateImageRequest,
  validateSummaryRequest,
} from './validate';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.length > 0) {
    if (config.allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: `${config.maxBodyMb}mb` }));

// ── Rate limiting ────────────────────────────────────────────
const hits = new Map<string, number[]>();
function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'local';
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (hits.get(key) ?? []).filter((stamp) => stamp > windowStart);
  if (recent.length >= config.rateLimitPerMinute) {
    res.status(429).json({
      error: {
        message: `Too many requests from this client (limit ${config.rateLimitPerMinute}/minute). Wait a moment and retry.`,
        code: 'rate_limited',
        status: 429,
      },
    });
    return;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) {
    for (const [client, stamps] of hits) {
      if (!stamps.some((stamp) => stamp > windowStart)) hits.delete(client);
    }
  }
  next();
}

function requireChat(): void {
  if (!config.ai.configured) {
    throw new AppError(
      'The AI provider is not configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL to .env, then restart the server.',
      503,
      'not_configured',
    );
  }
}

function requireImage(): void {
  if (!config.image.configured) {
    throw new AppError(
      config.image.provider === 'cloudflare'
        ? 'The image provider is not configured. Add IMAGE_API_KEY (a Cloudflare API token with Workers AI access) and IMAGE_ACCOUNT_ID to .env, then restart the server.'
        : 'The image provider is not configured. Add IMAGE_API_KEY and IMAGE_MODEL to .env, then restart the server.',
      503,
      'not_configured',
    );
  }
}

function normaliseHistory(history: ChatRequest['messages']): ProviderMessage[] {
  return history.map((message) => {
    const images = config.ai.vision ? (message.images ?? []) : [];
    if (images.length === 0) {
      return { role: message.role, content: message.content };
    }
    const parts: ContentPart[] = [{ type: 'text', text: message.content }];
    for (const image of images) {
      parts.push({ type: 'image_url', image_url: { url: image } });
    }
    return { role: message.role, content: parts };
  });
}

// ── Health ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const status: ProviderStatus = {
    ok: true,
    version: config.version,
    chat: {
      configured: config.ai.configured,
      model: config.ai.model,
      endpoint: endpointHost(config.ai.baseUrl),
      stream: config.ai.stream,
      vision: config.ai.vision,
    },
    image: {
      configured: config.image.configured,
      model: config.image.model,
      endpoint: endpointHost(config.image.baseUrl),
      reference: config.image.reference,
    },
    setup: setupChecklist(),
  };
  res.setHeader('Cache-Control', 'no-store');
  res.json(status);
});

// ── Chat (streaming SSE) ─────────────────────────────────────
app.post('/api/chat', rateLimit, async (req: Request, res: Response) => {
  const payload = validateChatRequest(req.body);
  requireChat();

  const messages: ProviderMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        project: payload.project,
        summary: payload.summary,
        avoidNames: payload.avoidNames ?? payload.project?.avoidNames,
        houseRules: payload.houseRules,
      }),
    },
    ...normaliseHistory(payload.messages),
  ];

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const controller = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort();
    }
  });

  const send = (event: unknown): void => {
    if (clientGone || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const result = await streamCompletion(
      messages,
      {
        model: payload.model || config.ai.model,
        signal: controller.signal,
      },
      (delta) => send({ type: 'delta', text: delta }),
    );
    send({ type: 'done', usage: result.usage ?? null });
  } catch (error) {
    if (clientGone) return;
    const payloadError = toErrorPayload(error);
    send({
      type: 'error',
      message: payloadError.body.error.message,
      code: payloadError.body.error.code,
    });
    console.error(`[movaryn] chat error: ${payloadError.body.error.message}`);
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// ── Image generation ─────────────────────────────────────────
app.post('/api/image', rateLimit, async (req: Request, res: Response) => {
  const payload = validateImageRequest(req.body);
  requireImage();
  const result: ImageResponse = await generateImage(payload);
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
});

// ── Conversation summarisation ───────────────────────────────
app.post('/api/summarize', rateLimit, async (req: Request, res: Response) => {
  const payload = validateSummaryRequest(req.body);
  requireChat();
  const content = payload.previous
    ? `Existing brief:\n${payload.previous}\n\nNew transcript to fold in:\n${payload.transcript}`
    : payload.transcript;
  const summary = await complete(
    [
      { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
      { role: 'user', content: `${SUMMARY_INSTRUCTION}\n\n${content}` },
    ],
    { model: config.ai.model, temperature: 0.2, maxTokens: 500 },
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ summary: summary.trim() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { message: 'Unknown API route.', code: 'not_found', status: 404 } });
});

// ── Static frontend (production) ─────────────────────────────
const staticDir = path.resolve(config.staticDir || path.join(process.cwd(), 'dist'));
const indexFile = path.join(staticDir, 'index.html');
if (fs.existsSync(indexFile)) {
  app.use(
    express.static(staticDir, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^\/(?!api(?:\/|$)).*/, (_req: Request, res: Response) => {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.sendFile(indexFile);
  });
}

// ── Errors ───────────────────────────────────────────────────
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const payload = toErrorPayload(error);
  if (payload.status >= 500) {
    console.error(`[movaryn] ${req.method} ${req.path}: ${payload.body.error.message}`);
  }
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(payload.status).json(payload.body);
});

const server = app.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(
    `[movaryn] API listening on http://${config.host}:${port} — chat ${
      config.ai.configured ? 'configured' : 'NOT configured'
    }, images ${config.image.configured ? 'configured' : 'NOT configured'}`,
  );
  // Read by the Electron main process to discover the assigned port.
  console.log(`MOVARYN_READY ${JSON.stringify({ port })}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[movaryn] Port ${config.port} is already in use. Stop the other process or set PORT to a free port.`,
    );
  } else {
    console.error(`[movaryn] Server error: ${error.message}`);
  }
  process.exit(1);
});

function shutdown(): void {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
