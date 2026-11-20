import type { Notebook, NotebookNoteKind } from '../../shared/types';
import { APP_VERSION } from './appVersion';
import { downloadText, slugify } from './utils';

const NOTE_LABELS: Record<NotebookNoteKind, string> = {
  briefing: 'Briefing',
  faq: 'FAQ',
  timeline: 'Timeline',
  guide: 'Study guide',
};

function timestamp(value: number): string {
  return new Date(value).toLocaleString();
}

/** One readable Markdown document: sources, notes and the Q&A transcript. */
export function notebookToMarkdown(notebook: Notebook): string {
  const lines: string[] = [
    `# ${notebook.title}`,
    '',
    `Exported from Movaryn ${APP_VERSION} on ${timestamp(Date.now())}.`,
    '',
    `${notebook.sources.length} source${notebook.sources.length === 1 ? '' : 's'} · ${notebook.notes.length} studio note${notebook.notes.length === 1 ? '' : 's'} · ${notebook.messages.length} transcript entr${notebook.messages.length === 1 ? 'y' : 'ies'}.`,
    '',
    '## Sources',
  ];

  if (notebook.sources.length === 0) {
    lines.push('', '_No sources in this notebook._');
  }
  notebook.sources.forEach((source, index) => {
    lines.push(
      '',
      `### ${index + 1}. ${source.title}`,
      '',
      `Added ${timestamp(source.createdAt)}.`,
    );
    if (source.url) lines.push('', `Reference: ${source.url}`);
    lines.push('', source.text.trim());
  });

  lines.push('', '## Studio notes');
  if (notebook.notes.length === 0) {
    lines.push('', '_No studio notes in this notebook._');
  }
  notebook.notes.forEach((note) => {
    lines.push('', `### ${note.title}`, '', `${NOTE_LABELS[note.kind]} · ${timestamp(note.createdAt)}`, '', note.content.trim());
  });

  lines.push('', '## Transcript');
  if (notebook.messages.length === 0) {
    lines.push('', '_No questions have been asked in this notebook._');
  }
  notebook.messages.forEach((message) => {
    const speaker = message.role === 'user' ? 'You' : 'Movaryn';
    lines.push('', `**${speaker}** — ${timestamp(message.createdAt)}`, '', message.content.trim() || '_No content._');
    if (message.status === 'error' && message.error) lines.push('', `_Error: ${message.error}_`);
    if (message.stopped) lines.push('', '_Stopped early._');
  });

  return `${lines.join('\n').trim()}\n`;
}

export function exportNotebook(notebook: Notebook): void {
  downloadText(`${slugify(notebook.title)}.md`, notebookToMarkdown(notebook), 'text/markdown');
}
