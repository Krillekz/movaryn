/**
 * Types shared by the browser app and the local API server.
 * Keep this file free of runtime dependencies so both builds can import it.
 */

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export const ASPECT_RATIOS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: '1:1', label: 'Square', hint: 'Portraits, icons, busts' },
  { value: '3:4', label: 'Portrait', hint: 'Full-body sheets, posters' },
  { value: '4:3', label: 'Landscape', hint: 'Duo shots, wide poses' },
  { value: '9:16', label: 'Tall', hint: 'Phone wallpapers, stance art' },
  { value: '16:9', label: 'Wide', hint: 'Cinematic key art' },
];

export type Framing = 'full-body' | 'three-quarter' | 'waist-up' | 'bust' | 'action';

export const FRAMING_OPTIONS: { value: Framing; label: string }[] = [
  { value: 'full-body', label: 'Full body' },
  { value: 'three-quarter', label: 'Three-quarter' },
  { value: 'waist-up', label: 'Waist up' },
  { value: 'bust', label: 'Bust / close-up' },
  { value: 'action', label: 'Mid-action' },
];

/** A prompt brief that the app turns into a provider-ready image prompt. */
export interface ImagePromptSpec {
  subject: string;
  details?: string;
  outfit?: string;
  pose?: string;
  framing: Framing;
  angle?: string;
  setting?: string;
  lighting?: string;
  style?: string;
  palette?: string;
  avoid?: string;
  aspect: AspectRatio;
  /** When set, this exact text is sent instead of the generated prompt. */
  promptOverride?: string;
  /** Optional reference image kept with the brief so revisions stay consistent. */
  reference?: ImageAttachment;
}

export interface ImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface GeneratedImage {
  id: string;
  dataUrl?: string;
  url?: string;
  aspect: AspectRatio;
  prompt: string;
  revisedPrompt?: string;
}

export type MessageStatus = 'streaming' | 'complete' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  attachments?: ImageAttachment[];
  images?: GeneratedImage[];
  status?: MessageStatus;
  error?: string;
  notice?: string;
  model?: string;
  kind?: 'text' | 'image';
  promptSpec?: ImagePromptSpec;
  stopped?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  messages: ChatMessage[];
  /** Condensed record of older turns, sent with new requests. */
  summary?: string;
  /** Number of leading messages already folded into `summary`. */
  summaryCursor?: number;
}

export interface SavedMove {
  id: string;
  name: string;
  description: string;
  purpose?: string;
  source?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  game: string;
  theme?: string;
  description?: string;
  constraints?: string;
  moves: SavedMove[];
  references: ImageAttachment[];
  images: GeneratedImage[];
  /** Last prompts edited in the prompt-only tabs, so they come back with the project. */
  prompts?: {
    art?: string;
    card?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export type ThemePreference = 'dark' | 'light' | 'system';
export type ImageQuality = '' | 'low' | 'medium' | 'high' | 'auto';

export interface Settings {
  theme: ThemePreference;
  /** Empty string means "use the server default". */
  chatModel: string;
  imageModel: string;
  aspect: AspectRatio;
  imageQuality: ImageQuality;
  /** How many recent messages are sent verbatim before relying on the summary. */
  contextWindow: number;
  /** Include the most recent reference images in chat requests. */
  attachReferences: boolean;
  /** Remember the last image style across briefs. */
  lastImageStyle: string;
}

export interface ProjectMovePayload {
  name: string;
  description: string;
  purpose?: string;
}

export interface ProjectContextPayload {
  name?: string;
  game?: string;
  theme?: string;
  description?: string;
  constraints?: string;
  moves?: ProjectMovePayload[];
  avoidNames?: string[];
}

export interface ChatTurnPayload {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatRequest {
  messages: ChatTurnPayload[];
  summary?: string;
  project?: ProjectContextPayload;
  /** Move names already used anywhere in this project. */
  avoidNames?: string[];
  model?: string;
}

export interface ImageRequest {
  prompt: string;
  aspect: AspectRatio;
  model?: string;
  quality?: ImageQuality;
  reference?: { dataUrl: string; name: string } | null;
}

export interface ImageResponse {
  images: GeneratedImage[];
  notice?: string;
  model?: string;
}

export interface SummaryRequest {
  transcript: string;
  previous?: string;
}

export interface ProviderStatus {
  ok: boolean;
  version: string;
  chat: {
    configured: boolean;
    model: string;
    endpoint: string;
    stream: boolean;
    vision: boolean;
  };
  image: {
    configured: boolean;
    model: string;
    endpoint: string;
    reference: boolean;
  };
  setup: string[];
}

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    status?: number;
  };
}
