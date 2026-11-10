/**
 * A compact, read-only kit that travels in the URL fragment.
 *
 * No account, no upload and no server: the kit is encoded on the device that
 * shares it and decoded by the reader's browser. Fragments are not sent to a
 * web server, so a shared kit never lands in an access log.
 */

import type { BriefMode, CharacterBrief } from './types';

export interface SharedKitMove {
  n: string;
  d: string;
  p?: string;
}

export interface SharedKit {
  v: 1;
  name: string;
  game: string;
  theme?: string;
  constraints?: string;
  moves: SharedKitMove[];
  brief?: {
    mode: BriefMode;
    series?: string;
    version?: string;
    facts: { t: string; s?: string }[];
  };
}

export interface ShareSource {
  name: string;
  game: string;
  theme?: string;
  constraints?: string;
  moves: { name: string; description: string; purpose?: string }[];
  brief?: CharacterBrief;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlEncode(bytes: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += ALPHABET[(buffer >> bits) & 63];
    }
  }
  if (bits > 0) output += ALPHABET[(buffer << (6 - bits)) & 63];
  return output;
}

function base64UrlDecode(text: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of text) {
    const value = ALPHABET.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

function encodeText(value: string): string {
  if (typeof TextEncoder !== 'undefined') return base64UrlEncode(new TextEncoder().encode(value));
  // TextEncoder is available in every supported browser and in Node 20, so this
  // fallback only covers an exotic embedding.
  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index);
  return base64UrlEncode(bytes);
}

function decodeText(value: string): string | null {
  const bytes = base64UrlDecode(value);
  if (!bytes) return null;
  try {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return decodeURIComponent(escape(binary));
  } catch {
    return null;
  }
}

export function encodeSharedKit(source: ShareSource): string {
  const kit: SharedKit = {
    v: 1,
    name: source.name.trim().slice(0, 160),
    game: source.game.trim().slice(0, 160),
    theme: source.theme?.trim().slice(0, 200) || undefined,
    constraints: source.constraints?.trim().slice(0, 1_200) || undefined,
    moves: source.moves.slice(0, 24).map((move) => ({
      n: move.name.trim().slice(0, 120),
      d: move.description.trim().slice(0, 1_600),
      p: move.purpose?.trim().slice(0, 160) || undefined,
    })),
    brief:
      source.brief && (source.brief.series || source.brief.facts.length > 0)
        ? {
            mode: source.brief.mode,
            series: source.brief.series?.slice(0, 160),
            version: source.brief.version?.slice(0, 160),
            facts: source.brief.facts.slice(0, 16).map((fact) => ({
              t: fact.text.slice(0, 300),
              s: fact.source?.slice(0, 300),
            })),
          }
        : undefined,
  };
  return encodeText(JSON.stringify(kit));
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function decodeSharedKit(code: string): SharedKit | null {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 120_000) return null;
  const text = decodeText(trimmed);
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (!Array.isArray(raw.moves)) return null;
  const moves: SharedKitMove[] = [];
  for (const entry of raw.moves.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const move = entry as Record<string, unknown>;
    const name = clean(move.n, 120);
    const description = clean(move.d, 1_600);
    if (!name || !description) continue;
    moves.push({ n: name, d: description, p: clean(move.p, 160) || undefined });
  }
  if (moves.length === 0) return null;

  const briefRaw = raw.brief && typeof raw.brief === 'object' ? (raw.brief as Record<string, unknown>) : null;
  const factsRaw = briefRaw && Array.isArray(briefRaw.facts) ? briefRaw.facts.slice(0, 16) : [];
  const facts: { t: string; s?: string }[] = [];
  for (const entry of factsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry as Record<string, unknown>;
    const text = clean(fact.t, 300);
    if (text) facts.push({ t: text, s: clean(fact.s, 300) || undefined });
  }
  const mode: BriefMode =
    briefRaw?.mode === 'original' || briefRaw?.mode === 'mixed' || briefRaw?.mode === 'canon'
      ? briefRaw.mode
      : 'canon';

  return {
    v: 1,
    name: clean(raw.name, 160) || 'Untitled character',
    game: clean(raw.game, 160),
    theme: clean(raw.theme, 200) || undefined,
    constraints: clean(raw.constraints, 1_200) || undefined,
    moves,
    brief: briefRaw
      ? { mode, series: clean(briefRaw.series, 160) || undefined, version: clean(briefRaw.version, 160) || undefined, facts }
      : undefined,
  };
}

/** `#kit=…` keeps the payload out of the path and out of server logs. */
export function sharedKitUrl(code: string): string {
  // The shared module is also compiled for the Node server, which has no DOM
  // types, so the browser location is read through globalThis.
  const location = (globalThis as { location?: { origin?: string; pathname?: string } }).location;
  const base =
    typeof location?.origin === 'string' && typeof location.pathname === 'string'
      ? `${location.origin}${location.pathname}`
      : 'https://krillekz.github.io/movaryn/app/';
  return `${base}#kit=${code}`;
}

export function sharedKitFromLocation(hash: string): SharedKit | null {
  const match = /(?:^#|&)kit=([A-Za-z0-9_-]+)/.exec(hash);
  if (!match) return null;
  return decodeSharedKit(match[1]);
}
