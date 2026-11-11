import type {
  ChatRequest,
  Notebook,
  NotebookNoteKind,
} from '../../shared/types';
import { useApp } from '../store/useApp';
import { streamChat } from './api';
import { uid } from './utils';

interface StudioKind {
  label: string;
  instruction: string;
}

export const NOTEBOOK_STUDIO: Record<NotebookNoteKind, StudioKind> = {
  briefing: {
    label: 'Briefing',
    instruction:
      'Write a briefing document from these sources. Open with a two-sentence overview, then cover the key facts, the important relationships and the open questions. Keep it under 500 words.',
  },
  faq: {
    label: 'FAQ',
    instruction:
      'Write a frequently-asked-questions document from these sources. Use 6–10 questions with short, direct answers. Only answer what the sources support.',
  },
  timeline: {
    label: 'Timeline',
    instruction:
      'Write a chronological timeline from these sources. Use one bullet per event with the date or order first, then what happened. Mark uncertain dates as uncertain.',
  },
  guide: {
    label: 'Study guide',
    instruction:
      'Write a study guide from these sources. Include the core concepts, five questions to test understanding, and a short answer key. Keep it practical.',
  },
};

let activeAbort: AbortController | null = null;

function buildRequest(notebook: Notebook): ChatRequest {
  const { settings } = useApp.getState();
  return {
    messages: notebook.messages
      .filter((message) => message.status !== 'streaming' && message.content.trim())
      .slice(-20)
      .map((message) => ({ role: message.role, content: message.content })),
    notebook: {
      title: notebook.title,
      sources: notebook.sources.map((source) => ({ title: source.title, text: source.text })),
    },
    model: settings.chatModel.trim() || undefined,
    responseStyle: settings.responseStyle,
    responseFormat: settings.responseFormat,
    explainChoices: settings.explainChoices || undefined,
  };
}

function fail(message: string): void {
  useApp.getState().pushToast(message, 'danger');
}

function canRun(notebook: Notebook): boolean {
  const state = useApp.getState();
  if (!state.provider?.chat.configured) {
    fail('The AI provider is not configured, so the notebook cannot answer yet.');
    return false;
  }
  if (notebook.sources.length === 0) {
    fail('Add at least one source before asking the notebook.');
    return false;
  }
  if (notebook.messages.some((message) => message.status === 'streaming')) {
    fail('The notebook is still writing. Stop it or wait for the answer.');
    return false;
  }
  return true;
}

async function streamInto(
  notebookId: string,
  assistantId: string,
  request: ChatRequest,
  note?: { kind: NotebookNoteKind; title: string },
): Promise<void> {
  const controller = new AbortController();
  activeAbort = controller;

  let full = '';
  let frame: number | null = null;
  let pending = false;

  const flush = () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    pending = false;
    useApp.getState().patchNotebookMessage(notebookId, assistantId, { content: full });
  };

  const schedule = () => {
    if (frame !== null) return;
    pending = true;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (!pending) return;
      pending = false;
      useApp.getState().patchNotebookMessage(notebookId, assistantId, { content: full });
    });
  };

  try {
    await streamChat(request, {
      signal: controller.signal,
      onDelta: (text) => {
        full += text;
        schedule();
      },
    });
    flush();
    if (!full.trim()) {
      useApp.getState().patchNotebookMessage(notebookId, assistantId, {
        content: '',
        status: 'error',
        error: 'The provider returned an empty answer.',
      });
      return;
    }
    useApp.getState().patchNotebookMessage(notebookId, assistantId, {
      content: full,
      status: 'complete',
      stopped: controller.signal.aborted || undefined,
    });
    if (note && !controller.signal.aborted) {
      useApp.getState().addNotebookNote(notebookId, {
        title: note.title,
        kind: note.kind,
        content: full,
      });
    }
  } catch (error) {
    flush();
    if (controller.signal.aborted) {
      useApp.getState().patchNotebookMessage(notebookId, assistantId, {
        content: full,
        status: 'complete',
        stopped: true,
      });
    } else {
      useApp.getState().patchNotebookMessage(notebookId, assistantId, {
        content: full,
        status: 'error',
        error: error instanceof Error ? error.message : 'The notebook could not answer.',
      });
    }
  } finally {
    if (frame !== null) window.cancelAnimationFrame(frame);
    if (activeAbort === controller) activeAbort = null;
  }
}

/** Ask one grounded question against the notebook's sources. */
export async function askNotebook(notebookId: string, question: string): Promise<boolean> {
  const state = useApp.getState();
  const notebook = state.notebooks[notebookId];
  const text = question.trim();
  if (!notebook || !text || !canRun(notebook)) return false;

  const userId = uid('nmsg');
  state.appendNotebookMessage(notebookId, {
    id: userId,
    role: 'user',
    content: text,
    createdAt: Date.now(),
    status: 'complete',
  });

  const current = useApp.getState().notebooks[notebookId];
  if (!current) return false;

  const assistantId = uid('nmsg');
  useApp.getState().appendNotebookMessage(notebookId, {
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
  });

  await streamInto(notebookId, assistantId, buildRequest(current));
  return true;
}

/** Generate a studio document and save it as a notebook note. */
export async function generateNotebookNote(
  notebookId: string,
  kind: NotebookNoteKind,
): Promise<void> {
  const state = useApp.getState();
  const notebook = state.notebooks[notebookId];
  if (!notebook || !canRun(notebook)) return;

  const studio = NOTEBOOK_STUDIO[kind];
  const request = buildRequest(notebook);
  request.messages = [
    ...request.messages,
    {
      role: 'user',
      content: `${studio.instruction}\n\nReturn clean Markdown with a short title. Cite sources as [Source title].`,
    },
  ];

  const assistantId = uid('nmsg');
  useApp.getState().appendNotebookMessage(notebookId, {
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
  });

  await streamInto(notebookId, assistantId, request, {
    kind,
    title: studio.label,
  });
}

export function stopNotebook(): void {
  activeAbort?.abort();
}
