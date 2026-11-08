import type {
  AspectRatio,
  ChatRequest,
  ChatTurnPayload,
  ImageQuality,
  ImageRequest,
  ProjectContextPayload,
  SummaryRequest,
} from '../shared/types';
import { ASPECT_RATIOS } from '../shared/types';
import { AppError } from './errors';

const MAX_MESSAGES = 220;
const MAX_CONTENT_CHARS = 24_000;
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_IMAGE_DATA_CHARS = 12_000_000;
const MAX_SUMMARY_CHARS = 12_000;
const MAX_PROJECT_TEXT = 6_000;

const ASPECTS = new Set<string>(ASPECT_RATIOS.map((item) => item.value));
const QUALITIES = new Set(['', 'low', 'medium', 'high', 'auto']);

function fail(message: string): never {
  throw new AppError(message, 400, 'invalid_request');
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) fail(`${label} is too long (max ${maxLength} characters).`);
  return trimmed || undefined;
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`);
  return optionalString(value, label, maxLength) as string;
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(value);
}

function validateImages(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) fail(`${label} must be a list of images.`);
  if (value.length > MAX_IMAGES_PER_MESSAGE) {
    fail(`Too many images attached (max ${MAX_IMAGES_PER_MESSAGE}).`);
  }
  const images: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isImageDataUrl(item)) {
      fail(`${label} must contain base64 image data URLs.`);
    }
    if (item.length > MAX_IMAGE_DATA_CHARS) fail('An attached image is too large.');
    images.push(item);
  }
  return images.length ? images : undefined;
}

function validateProject(value: unknown): ProjectContextPayload | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = asObject(value, 'project');
  const movesRaw = raw.moves;
  const project: ProjectContextPayload = {
    name: optionalString(raw.name, 'project.name', 160),
    game: optionalString(raw.game, 'project.game', 160),
    theme: optionalString(raw.theme, 'project.theme', 400),
    description: optionalString(raw.description, 'project.description', MAX_PROJECT_TEXT),
    constraints: optionalString(raw.constraints, 'project.constraints', MAX_PROJECT_TEXT),
  };

  if (movesRaw !== undefined) {
    if (!Array.isArray(movesRaw)) fail('project.moves must be a list.');
    if (movesRaw.length > 80) fail('project.moves is too long (max 80 moves).');
    project.moves = movesRaw.map((entry, index) => {
      const move = asObject(entry, `project.moves[${index}]`);
      return {
        name: requiredString(move.name, 'Move name', 120),
        description: requiredString(move.description, 'Move description', 2_000),
        purpose: optionalString(move.purpose, 'Move purpose', 240),
      };
    });
  }

  if (raw.avoidNames !== undefined) {
    if (!Array.isArray(raw.avoidNames)) fail('project.avoidNames must be a list.');
    project.avoidNames = raw.avoidNames
      .slice(0, 200)
      .map((name) => (typeof name === 'string' ? name.trim().slice(0, 120) : ''))
      .filter(Boolean);
  }

  return project;
}

export function validateChatRequest(body: unknown): ChatRequest {
  const raw = asObject(body, 'Request body');
  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    fail('messages must be a non-empty list.');
  }
  if (raw.messages.length > MAX_MESSAGES) fail(`Too many messages (max ${MAX_MESSAGES}).`);

  const messages: ChatTurnPayload[] = raw.messages.map((entry, index) => {
    const message = asObject(entry, `messages[${index}]`);
    const role = message.role;
    if (role !== 'user' && role !== 'assistant') fail('Message roles must be user or assistant.');
    const content = requiredString(message.content, 'Message content', MAX_CONTENT_CHARS);
    return {
      role,
      content,
      images: validateImages(message.images, 'message.images'),
    };
  });

  const summary = optionalString(raw.summary, 'summary', MAX_SUMMARY_CHARS);
  const model = optionalString(raw.model, 'model', 120);
  if (model && !/^[A-Za-z0-9._:/@+-]+$/.test(model)) fail('Model name contains invalid characters.');

  let avoidNames: string[] | undefined;
  if (raw.avoidNames !== undefined) {
    if (!Array.isArray(raw.avoidNames)) fail('avoidNames must be a list.');
    avoidNames = raw.avoidNames
      .slice(0, 200)
      .map((name) => (typeof name === 'string' ? name.trim().slice(0, 120) : ''))
      .filter(Boolean);
  }

  return { messages, summary, project: validateProject(raw.project), avoidNames, model };
}

export function validateImageRequest(body: unknown): ImageRequest {
  const raw = asObject(body, 'Request body');
  const prompt = requiredString(raw.prompt, 'prompt', 4_000);
  const aspectRaw = typeof raw.aspect === 'string' ? raw.aspect : '1:1';
  if (!ASPECTS.has(aspectRaw)) fail('aspect must be one of 1:1, 3:4, 4:3, 9:16, 16:9.');

  const qualityRaw = typeof raw.quality === 'string' ? raw.quality.toLowerCase() : '';
  if (!QUALITIES.has(qualityRaw)) fail('quality must be low, medium, high, auto or empty.');

  const model = optionalString(raw.model, 'model', 120);
  if (model && !/^[A-Za-z0-9._:/@+-]+$/.test(model)) fail('Model name contains invalid characters.');

  let reference: ImageRequest['reference'] = null;
  if (raw.reference !== undefined && raw.reference !== null) {
    const ref = asObject(raw.reference, 'reference');
    if (typeof ref.dataUrl !== 'string' || !isImageDataUrl(ref.dataUrl)) {
      fail('reference.dataUrl must be a base64 image data URL.');
    }
    if (ref.dataUrl.length > MAX_IMAGE_DATA_CHARS) fail('The reference image is too large.');
    reference = {
      dataUrl: ref.dataUrl,
      name:
        typeof ref.name === 'string' && ref.name.trim()
          ? ref.name.trim().slice(0, 120)
          : 'reference.png',
    };
  }

  return {
    prompt,
    aspect: aspectRaw as AspectRatio,
    quality: qualityRaw as ImageQuality,
    model,
    reference,
  };
}

export function validateSummaryRequest(body: unknown): SummaryRequest {
  const raw = asObject(body, 'Request body');
  const transcript = requiredString(raw.transcript, 'transcript', 80_000);
  const previous = optionalString(raw.previous, 'previous', MAX_SUMMARY_CHARS);
  return { transcript, previous };
}
