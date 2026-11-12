import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  ChatRequest,
  ImageResponse,
  ProviderStatus,
  ResearchRequest,
  ResearchResponse,
} from '../shared/types';
import { buildSystemPrompt, SUMMARY_INSTRUCTION, SUMMARIZER_SYSTEM_PROMPT } from '../shared/systemPrompt';
import { config, endpointHost, setupChecklist } from './config';
import {
  authenticateAccount,
  changeAccountPassword,
  deleteAccount,
  exportAccountCredentials,
  getAccountStatus,
  loginAccount,
  importAccount,
  logoutAccount,
  registerAccount,
  updateAccountProfile,
} from './accounts';
import { AppError, toErrorPayload } from './errors';
import { complete, streamCompletion, type ContentPart, type ProviderMessage } from './providers/openai';
import { generateImage } from './providers/images';
import {
  validateChatRequest,
  validateImageRequest,
  validateResearchRequest,
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

  // With an explicit allow-list, a disallowed page must not reach the API at
  // all. Without this, a third-party page could still spend provider credits
  // even though it could not read the response.
  if (origin && config.allowedOrigins.length > 0 && !config.allowedOrigins.includes('*')) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === req.headers.host;
    } catch {
      sameHost = false;
    }
    if (!sameHost && !config.allowedOrigins.includes(origin)) {
      res.status(403).json({
        error: {
          message: 'This origin is not allowed. Add it to ALLOWED_ORIGINS on the API server.',
          code: 'origin_not_allowed',
          status: 403,
        },
      });
      return;
    }
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

const authHits = new Map<string, number[]>();
function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'local';
  const now = Date.now();
  const recent = (authHits.get(key) ?? []).filter((stamp) => stamp > now - 60_000);
  if (recent.length >= 15) {
    res.status(429).json({
      error: {
        message: 'Too many account requests. Wait a minute and try again.',
        code: 'rate_limited',
        status: 429,
      },
    });
    return;
  }
  recent.push(now);
  authHits.set(key, recent);
  if (authHits.size > 200) {
    for (const [client, stamps] of authHits) {
      if (!stamps.some((stamp) => stamp > now - 60_000)) authHits.delete(client);
    }
  }
  next();
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  const token = header.slice(7).trim();
  return token || undefined;
}

async function requireAccount(req: Request): Promise<{ token: string; user: Awaited<ReturnType<typeof authenticateAccount>> }> {
  const token = bearerToken(req);
  const user = await authenticateAccount(token);
  if (!token || !user) {
    throw new AppError('Sign in to continue.', 401, 'unauthorized');
  }
  return { token, user };
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

// ── Local accounts ───────────────────────────────────────────
app.get('/api/auth/status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getAccountStatus(bearerToken(req)));
});

app.post('/api/auth/register', authRateLimit, async (req: Request, res: Response) => {
  const session = await registerAccount({
    username: req.body?.username,
    password: req.body?.password,
    displayName: req.body?.displayName,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json(session);
});

app.post('/api/auth/login', authRateLimit, async (req: Request, res: Response) => {
  const session = await loginAccount({
    username: req.body?.username,
    password: req.body?.password,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(session);
});

app.post('/api/auth/logout', authRateLimit, async (req: Request, res: Response) => {
  await logoutAccount(bearerToken(req));
  res.status(204).end();
});

app.patch('/api/account', authRateLimit, async (req: Request, res: Response) => {
  const { token } = await requireAccount(req);
  const user = await updateAccountProfile(token, { displayName: req.body?.displayName });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user });
});

app.post('/api/account/backup', authRateLimit, async (req: Request, res: Response) => {
  const { token } = await requireAccount(req);
  const account = await exportAccountCredentials(token, { password: req.body?.password });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ account });
});

app.post('/api/account/restore', authRateLimit, async (req: Request, res: Response) => {
  const session = await importAccount({ account: req.body?.account });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json(session);
});

app.post('/api/account/password', authRateLimit, async (req: Request, res: Response) => {
  const { token } = await requireAccount(req);
  const session = await changeAccountPassword(token, {
    currentPassword: req.body?.currentPassword,
    newPassword: req.body?.newPassword,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(session);
});

app.delete('/api/account', authRateLimit, async (req: Request, res: Response) => {
  const { token } = await requireAccount(req);
  await deleteAccount(token, { password: req.body?.password });
  res.status(204).end();
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
        notebook: payload.notebook,
        summary: payload.summary,
        avoidNames: payload.avoidNames ?? payload.project?.avoidNames,
        houseRules: payload.houseRules,
        quickKit: payload.quickKit,
        responseStyle: payload.responseStyle,
        responseFormat: payload.responseFormat,
        explainChoices: payload.explainChoices,
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

// ── Character research ───────────────────────────────────────
const RESEARCH_SYSTEM_PROMPT = `You research fictional characters for a moveset designer. You have no web access: use only what you can support from a named source.

Return JSON only, with this exact shape:
{"character":"...","series":"...","version":"...","facts":[{"text":"...","source":"..."}],"uncertain":false}

Rules:
- Include a fact only when you can name a real source for it: a manga chapter, an episode, an official profile, a databook, or an in-game description. Put that source in "source".
- Never invent a source, a series, an ability, a weapon or a silhouette detail.
- If you cannot name a source, leave the fact out.
- If you do not know the character, return an empty facts list and "uncertain": true.
- Do not claim to have browsed the web. Do not add commentary outside the JSON.
- At most six facts, each under 200 characters.`;

function cleanResearchText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function parseResearchReply(
  raw: string,
  payload: ResearchRequest,
  model: string,
): ResearchResponse {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new AppError(
      'The provider returned no readable research. Nothing was added to the brief.',
      502,
      'research_failed',
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new AppError(
      'The provider returned unreadable research. Nothing was added to the brief.',
      502,
      'research_failed',
    );
  }

  const factsRaw = Array.isArray(parsed.facts) ? parsed.facts : [];
  const facts: ResearchResponse['facts'] = [];
  for (const entry of factsRaw.slice(0, 6)) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry as Record<string, unknown>;
    const text = cleanResearchText(fact.text, 400);
    const source = cleanResearchText(fact.source, 300);
    // A fact without a named source is not shown: the point of the lookup is
    // to avoid confident guessing, not to dress a guess up with a citation.
    if (text && source) facts.push({ text, source });
  }

  const uncertain = parsed.uncertain === true || facts.length === 0;
  return {
    character: cleanResearchText(parsed.character, 160) || payload.character,
    series: cleanResearchText(parsed.series, 200) || payload.series,
    version: cleanResearchText(parsed.version, 200) || undefined,
    facts,
    uncertain,
    message: uncertain
      ? `No sourced facts came back for ${payload.character}. Add the series or a short description instead — Movaryn will not guess.`
      : `Kept ${facts.length} sourced fact${facts.length === 1 ? '' : 's'}. Sources are listed beside each fact; open them before treating a detail as canon.`,
    model,
  };
}

app.post('/api/research', rateLimit, async (req: Request, res: Response) => {
  const payload = validateResearchRequest(req.body);
  requireChat();
  if (!config.ai.research) {
    throw new AppError(
      'Character research is switched off on this API. Set AI_RESEARCH=true to enable it.',
      503,
      'research_disabled',
    );
  }

  const prompt = [
    `CHARACTER: ${payload.character}`,
    payload.series ? `SERIES: ${payload.series}` : '',
    payload.game ? `TARGET GAME: ${payload.game}` : '',
    payload.notes ? `NOTES FROM THE USER: ${payload.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await complete(
    [
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    { model: config.ai.model, temperature: 0.2, maxTokens: 700 },
  );
  const result = parseResearchReply(raw, payload, config.ai.model);
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
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
