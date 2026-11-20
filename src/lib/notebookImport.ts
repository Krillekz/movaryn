export const MAX_NOTEBOOK_SOURCE_CHARS = 20_000;

const MAX_IMPORT_BYTES = 2_000_000;

export interface NotebookImportSource {
  title: string;
  text: string;
}

export interface NotebookImportResult {
  sources: NotebookImportSource[];
  skipped: { name: string; reason: string }[];
}

/** Read .txt and .md files as notebook sources without sending them anywhere. */
export async function readNotebookFiles(files: File[]): Promise<NotebookImportResult> {
  const sources: NotebookImportSource[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      skipped.push({ name: file.name, reason: 'not a .txt or .md file' });
      continue;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      skipped.push({ name: file.name, reason: 'larger than 2 MB' });
      continue;
    }
    let text = '';
    try {
      text = (await file.text()).replace(/\r\n?/g, '\n').trim();
    } catch {
      skipped.push({ name: file.name, reason: 'could not be read' });
      continue;
    }
    if (!text) {
      skipped.push({ name: file.name, reason: 'empty' });
      continue;
    }
    if (text.length > MAX_NOTEBOOK_SOURCE_CHARS) {
      skipped.push({ name: file.name, reason: `over ${MAX_NOTEBOOK_SOURCE_CHARS.toLocaleString()} characters` });
      continue;
    }
    const title = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 140) || 'Imported source';
    sources.push({ title, text });
  }

  return { sources, skipped };
}
