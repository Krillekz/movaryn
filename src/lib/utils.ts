export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function uid(prefix = 'id'): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && 'randomUUID' in cryptoObj) {
    return `${prefix}_${cryptoObj.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** A readable conversation title from the first user message. */
export function titleFromText(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  const withoutPreamble = singleLine.replace(
    /^(please\s+)?(can you\s+|could you\s+|i need you to\s+|help me\s+|make me\s+|give me\s+)/i,
    '',
  );
  const cleaned = withoutPreamble.replace(/[.?!]+$/, '');
  return truncate(cleaned.charAt(0).toUpperCase() + cleaned.slice(1), 52) || 'New chat';
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export function aspectRatioCss(aspect: string): string {
  return aspect.replace(':', ' / ');
}

export function downloadUrl(filename: string, url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noreferrer';
  link.target = '_blank';
  link.click();
}

export function groupByDay<T extends { updatedAt: number }>(items: T[]): {
  label: string;
  items: T[];
}[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;

  const groups: { label: string; min: number; max: number }[] = [
    { label: 'Today', min: startOfToday, max: Number.POSITIVE_INFINITY },
    { label: 'Yesterday', min: startOfToday - day, max: startOfToday },
    { label: 'Previous 7 days', min: startOfToday - 7 * day, max: startOfToday - day },
    { label: 'Older', min: Number.NEGATIVE_INFINITY, max: startOfToday - 7 * day },
  ];

  return groups
    .map((group) => ({
      label: group.label,
      items: items.filter((item) => item.updatedAt >= group.min && item.updatedAt < group.max),
    }))
    .filter((group) => group.items.length > 0);
}
