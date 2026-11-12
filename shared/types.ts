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

export type BriefMode = 'canon' | 'original' | 'mixed';

export interface CharacterFact {
  id: string;
  text: string;
  source?: string;
  /** Where the fact came from, so canon, research and invention stay distinct. */
  origin: 'brief' | 'lookup' | 'invented';
}

export interface CharacterBrief {
  series?: string;
  version?: string;
  abilities?: string;
  avoid?: string;
  mode: BriefMode;
  facts: CharacterFact[];
  /** True once a lookup produced at least one sourced fact the user kept. */
  verified: boolean;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  game: string;
  theme?: string;
  description?: string;
  constraints?: string;
  /** Project-scoped character brief: canon decisions and sourced facts. */
  brief?: CharacterBrief;
  matchupNotes?: string;
  sandboxPreset?: string;
  /** Last kit comparison saved with this project; local only. */
  comparison?: {
    createdAt: number;
    presetName: string;
    kitNames: string[];
    summary: string;
  };
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

export type ChatWidth = 'narrow' | 'standard' | 'wide';
export type ChatDensity = 'compact' | 'comfortable' | 'spacious';
export type ResponseStyle = 'concise' | 'balanced' | 'detailed';
export type ResponseFormat = 'prose' | 'mixed' | 'bullets';

export type ThemePreference = 'dark' | 'light' | 'system';
export type AccentId = 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'mono';
export type AmbienceId = 'plain' | 'grid' | 'glow';
export type CornerStyle = 'sharp' | 'soft' | 'round';
export type ReadingFont = 'sans' | 'serif';
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
  /** Extra instructions the user wants applied to every chat on this device. */
  houseRules: string;
  /** Draft one coherent pass first instead of opening with an essay. */
  quickKit: boolean;
  /** Reading layout of the chat area. */
  layoutWidth: ChatWidth;
  layoutDensity: ChatDensity;
  /** How the assistant should shape its replies. */
  responseStyle: ResponseStyle;
  responseFormat: ResponseFormat;
  explainChoices: boolean;
  /** Design system: accent palette, background atmosphere and interface shape. */
  accent: AccentId;
  ambience: AmbienceId;
  corners: CornerStyle;
  readingFont: ReadingFont;
  reduceMotion: boolean;
  sidebarCompact: boolean;
}

export interface AccountUser {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
}

export interface AccountSession {
  token: string;
  user: AccountUser;
}

export interface AccountCredentialRecord {
  username: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  passwordHash: string;
  salt: string;
}

export interface AccountStatus {
  enabled: true;
  hasAccounts: boolean;
  user: AccountUser | null;
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
  brief?: CharacterBrief;
  matchupNotes?: string;
}

export interface ChatTurnPayload {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface NotebookSource {
  id: string;
  title: string;
  text: string;
  url?: string;
  createdAt: number;
}

export interface NotebookMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status?: MessageStatus;
  error?: string;
  stopped?: boolean;
}

export type NotebookNoteKind = 'briefing' | 'faq' | 'timeline' | 'guide';

export interface NotebookNote {
  id: string;
  title: string;
  kind: NotebookNoteKind;
  content: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  title: string;
  sources: NotebookSource[];
  messages: NotebookMessage[];
  notes: NotebookNote[];
  createdAt: number;
  updatedAt: number;
}

export interface NotebookContextPayload {
  title?: string;
  sources: { title: string; text: string }[];
}

export interface ChatRequest {
  messages: ChatTurnPayload[];
  summary?: string;
  project?: ProjectContextPayload;
  notebook?: NotebookContextPayload;
  responseStyle?: ResponseStyle;
  responseFormat?: ResponseFormat;
  explainChoices?: boolean;
  /** Move names already used anywhere in this project. */
  avoidNames?: string[];
  /** Device-level preferences from Settings → Prompts. */
  houseRules?: string;
  model?: string;
  /** Ask for one coherent pass, with the first move before the rest. */
  quickKit?: boolean;
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

export interface ResearchRequest {
  character: string;
  series?: string;
  game?: string;
  notes?: string;
}

export interface ResearchFact {
  text: string;
  source?: string;
}

export interface ResearchResponse {
  character: string;
  series?: string;
  version?: string;
  facts: ResearchFact[];
  /** True when the lookup could not find sourced facts and the app should ask. */
  uncertain: boolean;
  message?: string;
  model?: string;
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
