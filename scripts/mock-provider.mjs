/**
 * Local mock provider for pipeline testing only.
 *
 * This is NOT used by the app and is never enabled automatically. It exists so
 * contributors can verify streaming, error handling, the moveset parser and the
 * image flow without spending provider credits or owning an API key.
 *
 * Run it, then point the API server at it:
 *   node scripts/mock-provider.mjs
 *   AI_BASE_URL=http://127.0.0.1:4010/v1 AI_API_KEY=mock AI_MODEL=mock-model \
 *     IMAGE_API_KEY=mock IMAGE_MODEL=mock-image npm run dev:api
 *
 * (On Windows PowerShell, set the variables with $env:NAME="value" first.)
 */
import http from 'node:http';
import zlib from 'node:zlib';

const PORT = Number(process.env.MOCK_PORT || 4010);

const MOVESET = `CHARACTER: Ash of the Hollow Bell
THEME: Funeral rites, bronze bells and drifting ash
GAME: Jujutsu Shenanigans

BASE MOVES
1. Bell Toll
Description: A short step-in that ends in a shoulder check with the bell's handle. On hit it stuns for 0.4s and opens a follow-up. Recovery is fast on whiff so it can be used to bait.
Purpose: Combo starter

2. Ashfall
Description: The character flicks the bell, releasing a low forward cloud of ash. It travels about ten studs and slows movement inside it. No damage on its own.
Purpose: Approach / zoning

3. Hollow Ring
Description: An overhead swing that plants the bell on the ground, sending a ring of ash outward. Targets hit by the ring are knocked back; targets hit by the bell itself are slammed.
Purpose: Heavy finisher

4. Toll the Dead
Description: A grab that pulls the opponent by the collar into a knee, then shoves them away. Whiffs leave the character exposed for half a second.
Purpose: Grab / reset

BUILD DIFFICULTY:
- Easy: one weapon mesh already in the game, standard hitboxes and a basic particle for the ash.
- No custom rigs or scripts are needed.`;

let cachedPng = null;
function getPng() {
  if (!cachedPng) cachedPng = makePng(384);
  return cachedPng;
}

function makePng(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 4;
      const glow = Math.round(60 + 80 * (1 - Math.abs(x / size - 0.5) * 2));
      raw[offset] = 20;
      raw[offset + 1] = 18 + glow / 4;
      raw[offset + 2] = 40 + glow;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])) >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const parts = [];
    req.on('data', (part) => parts.push(part));
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    const raw = await readBody(req);
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { error: { message: 'Invalid JSON' } });
      return;
    }

    if (body.stream === false) {
      sendJson(res, 200, {
        choices: [{ message: { role: 'assistant', content: MOVESET }, finish_reason: 'stop' }],
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const words = MOVESET.split(/(\s+)/);
    let index = 0;
    const interval = setInterval(() => {
      if (index >= words.length) {
        clearInterval(interval);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const chunkText = words.slice(index, index + 3).join('');
      index += 3;
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: chunkText } }] })}\n\n`,
      );
    }, 12);

    req.on('close', () => clearInterval(interval));
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/images/generations')) {
    await readBody(req);
    sendJson(res, 200, { data: [{ b64_json: getPng().toString('base64') }] });
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/images/edits')) {
    // Deliberately unsupported, so the app exercises its honest fallback path.
    sendJson(res, 404, { error: { message: 'Image edits are not implemented by the mock provider.' } });
    return;
  }

  sendJson(res, 404, { error: { message: `Unknown mock route ${req.method} ${url.pathname}` } });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-provider] listening on http://127.0.0.1:${PORT}/v1`);
  console.log('[mock-provider] development fixture only — not used by the app by default.');
});
