import type {
  ChatMessage,
  ChatRequest,
  ImageAttachment,
  ImagePromptSpec,
} from '../../shared/types';
import { collectMoveNames } from '../../shared/moveset';
import { describeImageBrief, resolveImagePrompt } from '../../shared/imagePrompt';
import { requestImage, requestSummary, streamChat } from './api';
import { useApp, type AppState } from '../store/useApp';
import { clamp, titleFromText, uid } from './utils';

let currentAbort: AbortController | null = null;
const summarising = new Set<string>();

function scheduleFrame(callback: () => void): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, 16);
}

function cancelFrame(handle: number): void {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
    return;
  }
  window.clearTimeout(handle);
}

function providerReady(state: AppState): boolean {
  return Boolean(state.provider?.chat.configured);
}

function buildChatRequest(conversationId: string): ChatRequest {
  const { conversations, projects, settings, provider } = useApp.getState();
  const conversation = conversations[conversationId];
  const windowSize = clamp(settings.contextWindow, 4, 60);

  const usable = conversation.messages.filter(
    (message) => message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0,
  );
  const recent = usable.slice(-windowSize);
  while (recent.length > 0 && recent[0].role === 'assistant') recent.shift();

  const vision = provider?.chat.vision ?? true;
  const allowImages = vision && settings.attachReferences;

  let imageBudget = 2;
  const turns = recent.map((message) => ({
    role: message.role,
    content: message.content,
    images: [] as string[],
  }));

  for (let index = turns.length - 1; index >= 0 && imageBudget > 0; index -= 1) {
    const message = recent[index];
    if (message.role !== 'user' || !message.attachments?.length) continue;
    for (const attachment of message.attachments) {
      if (imageBudget <= 0) break;
      if (allowImages) {
        turns[index].images.push(attachment.dataUrl);
      } else {
        turns[index].content += `\n\n[The user attached a reference image: ${attachment.name}]`;
      }
      imageBudget -= 1;
    }
  }

  const history = turns.map((turn) =>
    turn.images.length > 0
      ? { role: turn.role, content: turn.content, images: turn.images }
      : { role: turn.role, content: turn.content },
  );

  const project = conversation.projectId ? projects[conversation.projectId] : undefined;

  const avoid = new Set<string>();
  const assistantTexts = conversation.messages
    .filter((message) => message.role === 'assistant' && message.content.trim())
    .map((message) => message.content);
  for (const name of collectMoveNames(assistantTexts)) avoid.add(name);
  if (project) {
    for (const move of project.moves) avoid.add(move.name);
  }

  return {
    messages: history,
    summary:
      conversation.summary && (conversation.summaryCursor ?? 0) > 0
        ? conversation.summary
        : undefined,
    project: project
      ? {
          name: project.name,
          game: project.game,
          theme: project.theme,
          description: project.description,
          constraints: project.constraints,
          brief: project.brief,
          matchupNotes: project.matchupNotes,
          moves: project.moves.map((move) => ({
            name: move.name,
            description: move.description,
            purpose: move.purpose,
          })),
        }
      : undefined,
    avoidNames: Array.from(avoid).slice(0, 120),
    houseRules: settings.houseRules.trim() || undefined,
    model: settings.chatModel.trim() || undefined,
    quickKit: settings.quickKit || undefined,
  };
}

/** Streams one assistant turn for an existing conversation. */
export async function runAssistantTurn(conversationId: string): Promise<void> {
  const initial = useApp.getState();
  const conversation = initial.conversations[conversationId];
  if (!conversation || !providerReady(initial)) return;

  const request = buildChatRequest(conversationId);
  const assistantId = uid('msg');
  const model = initial.settings.chatModel.trim() || initial.provider?.chat.model;

  useApp.getState().appendMessage(conversationId, {
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
    model,
  });
  useApp.getState().setStreaming({ conversationId, messageId: assistantId });

  const controller = new AbortController();
  currentAbort = controller;

  let full = '';
  let buffered = '';
  let frame: number | null = null;

  const flush = () => {
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
    if (!buffered) return;
    buffered = '';
    useApp.getState().patchMessage(conversationId, assistantId, { content: full });
  };

  const schedule = () => {
    if (frame !== null) return;
    frame = scheduleFrame(() => {
      frame = null;
      if (!buffered) return;
      buffered = '';
      useApp.getState().patchMessage(conversationId, assistantId, { content: full });
    });
  };

  try {
    await streamChat(request, {
      signal: controller.signal,
      onDelta: (text) => {
        full += text;
        buffered += text;
        schedule();
      },
    });
    flush();
    useApp.getState().patchMessage(conversationId, assistantId, {
      content: full,
      status: 'complete',
      stopped: controller.signal.aborted || undefined,
    });
    if (!controller.signal.aborted) void summariseConversation(conversationId);
  } catch (error) {
    flush();
    if (controller.signal.aborted) {
      useApp.getState().patchMessage(conversationId, assistantId, {
        content: full,
        status: 'complete',
        stopped: true,
      });
    } else {
      useApp.getState().patchMessage(conversationId, assistantId, {
        content: full,
        status: 'error',
        error: error instanceof Error ? error.message : 'Generation failed.',
      });
    }
  } finally {
    if (frame !== null) cancelFrame(frame);
    if (currentAbort === controller) currentAbort = null;
    useApp.getState().setStreaming(null);
  }
}

export async function sendMessage(
  text: string,
  attachments: ImageAttachment[] = [],
): Promise<boolean> {
  const state = useApp.getState();
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (state.streaming) {
    state.pushToast('Movaryn is still responding. Stop it or wait for the reply.', 'danger');
    return false;
  }
  if (!providerReady(state)) {
    state.pushToast(
      state.provider
        ? 'No AI provider is configured yet. Add your key to .env and restart the API.'
        : 'The Movaryn API is offline. Start it with "npm run dev" and retry.',
      'danger',
    );
    state.openSettings();
    return false;
  }

  const conversationId = state.activeId ?? state.newConversation();
  const conversation = useApp.getState().conversations[conversationId];
  if (!conversation) return false;

  const isFirstMessage = !conversation.messages.some((message) => message.role === 'user');
  useApp.getState().appendMessage(conversationId, {
    id: uid('msg'),
    role: 'user',
    content: trimmed,
    createdAt: Date.now(),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (isFirstMessage) {
    useApp.getState().renameConversation(conversationId, titleFromText(trimmed));
  }

  await runAssistantTurn(conversationId);
  return true;
}

export function stopGeneration(): void {
  currentAbort?.abort();
}

export async function regenerate(conversationId: string, messageId?: string): Promise<boolean> {
  const state = useApp.getState();
  if (state.streaming) {
    state.pushToast('Wait for the current reply to finish first.', 'danger');
    return false;
  }
  if (!providerReady(state)) {
    state.pushToast('No AI provider is configured yet.', 'danger');
    state.openSettings();
    return false;
  }

  const conversation = state.conversations[conversationId];
  if (!conversation || conversation.messages.length === 0) return false;

  let cutIndex = -1;
  if (messageId) {
    cutIndex = conversation.messages.findIndex((message) => message.id === messageId);
    if (cutIndex >= 0 && conversation.messages[cutIndex].role !== 'assistant') return false;
  } else if (conversation.messages[conversation.messages.length - 1]?.role === 'assistant') {
    cutIndex = conversation.messages.length - 1;
  }

  if (cutIndex >= 0) useApp.getState().truncateFrom(conversationId, cutIndex);
  await runAssistantTurn(conversationId);
  return true;
}

export async function editAndResend(
  conversationId: string,
  messageId: string,
  text: string,
): Promise<boolean> {
  const state = useApp.getState();
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (state.streaming) {
    state.pushToast('Wait for the current reply to finish first.', 'danger');
    return false;
  }
  if (!providerReady(state)) {
    state.pushToast('No AI provider is configured yet.', 'danger');
    state.openSettings();
    return false;
  }

  const conversation = state.conversations[conversationId];
  if (!conversation) return false;
  const index = conversation.messages.findIndex((message) => message.id === messageId);
  if (index < 0) return false;
  const original = conversation.messages[index];
  if (original.role !== 'user') return false;

  useApp.getState().truncateFrom(conversationId, index);
  const edited: ChatMessage = {
    ...original,
    content: trimmed,
    createdAt: Date.now(),
    status: undefined,
    error: undefined,
  };
  useApp.getState().appendMessage(conversationId, edited);
  await runAssistantTurn(conversationId);
  return true;
}

export async function generateConceptImage(
  spec: ImagePromptSpec,
  target?: { conversationId?: string; messageId?: string },
): Promise<boolean> {
  const state = useApp.getState();
  const conversationId = target?.conversationId ?? state.activeId ?? state.newConversation();
  const prompt = resolveImagePrompt(spec);
  const label = describeImageBrief(spec);
  const configuredImageModel = state.provider?.image.model.trim() ?? '';
  const preferredImageModel = state.settings.imageModel.trim();
  // Workers AI ids live in the @cf/ namespace. A model left in the settings field
  // from an OpenAI-style setup used to be sent anyway and Cloudflare answered
  // with "No route for that URI", so the configured provider model wins there.
  const imageModel =
    /^@cf\//i.test(configuredImageModel) && !/^@cf\//i.test(preferredImageModel)
      ? configuredImageModel
      : preferredImageModel || configuredImageModel;
  const messageId = target?.messageId ?? uid('msg');
  const now = Date.now();

  if (!target?.messageId) {
    useApp.getState().appendMessage(conversationId, {
      id: uid('msg'),
      role: 'user',
      content: `Concept art — ${label}`,
      createdAt: now,
    });
  }

  const base: ChatMessage = {
    id: messageId,
    role: 'assistant',
    kind: 'image',
    content: target?.messageId ? 'Regenerating concept art…' : 'Generating concept art…',
    createdAt: now,
    status: 'streaming',
    promptSpec: spec,
    model: imageModel || undefined,
  };

  if (target?.messageId) {
    useApp.getState().patchMessage(conversationId, messageId, { ...base, images: [] });
  } else {
    useApp.getState().appendMessage(conversationId, base);
  }

  try {
    const result = await requestImage({
      prompt,
      aspect: spec.aspect,
      model: imageModel || undefined,
      quality: useApp.getState().settings.imageQuality || undefined,
      reference: spec.reference
        ? { dataUrl: spec.reference.dataUrl, name: spec.reference.name }
        : null,
    });
    useApp.getState().patchMessage(conversationId, messageId, {
      status: 'complete',
      content: label,
      images: result.images,
      notice: result.notice,
      model: result.model,
      promptSpec: spec,
      error: undefined,
    });
    return true;
  } catch (error) {
    useApp.getState().patchMessage(conversationId, messageId, {
      status: 'error',
      content: '',
      error: error instanceof Error ? error.message : 'Image generation failed.',
      promptSpec: spec,
      images: [],
    });
    return false;
  }
}

/**
 * Folds older turns into a compact memory once a conversation gets long.
 * Runs in the background so it never blocks a reply; failures are harmless
 * because recent messages are always sent verbatim.
 */
export async function summariseConversation(conversationId: string): Promise<void> {
  const state = useApp.getState();
  const conversation = state.conversations[conversationId];
  if (!conversation || summarising.has(conversationId)) return;
  if (!providerReady(state)) return;

  const threshold = Math.max(16, state.settings.contextWindow * 2);
  if (conversation.messages.length < threshold) return;

  const cursor = conversation.summaryCursor ?? 0;
  const boundary = conversation.messages.length - 6;
  if (boundary <= cursor + 2) return;

  const slice = conversation.messages
    .slice(cursor, boundary)
    .filter((message) => message.content.trim().length > 0);
  if (slice.length === 0) return;

  const transcript = slice
    .map((message) => `${message.role === 'user' ? 'USER' : 'MOVARYN'}: ${message.content}`)
    .join('\n\n')
    .slice(-70_000);

  summarising.add(conversationId);
  try {
    const summary = await requestSummary({ transcript, previous: conversation.summary });
    if (!summary) return;
    const latest = useApp.getState().conversations[conversationId];
    if (!latest) return;
    useApp.getState().setSummary(conversationId, summary, boundary);
  } catch {
    // Context trimming still works without a summary; try again next turn.
  } finally {
    summarising.delete(conversationId);
  }
}
