export interface CharacterCardMove {
  name: string;
  purpose?: string;
  description?: string;
}

export interface CharacterCardInput {
  name: string;
  game?: string;
  theme?: string;
  moves: CharacterCardMove[];
  /** Data URL or remote URL for the character art shown on the right. */
  art?: string;
  accent?: string;
}

const WIDTH = 1600;
const HEIGHT = 1000;
const LEFT = 96;
const CONTENT = 744;
const ART = { x: 904, y: 72, w: 600, h: 856 };
const FONT = '"Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
const INK = '#f2f2f8';
const MUTED = 'rgba(168, 168, 186, 0.95)';
const FAINT = 'rgba(120, 120, 138, 0.9)';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function rgba(hex: string, alpha: number): string {
  const match = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!match) return `rgba(155, 138, 250, ${alpha})`;
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The character art could not be loaded.'));
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
): void {
  const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = box.x + (box.w - width) / 2;
  // Bias the crop upward so faces are not cut off.
  const y = box.y - (height - box.h) * 0.22;
  ctx.drawImage(image, x, y, width, height);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines).map((line, index) =>
    index === maxLines - 1 ? ellipsize(ctx, line, maxWidth) : line,
  );
}

/**
 * Draws the character card template: name and moves on the left, the character
 * art on the right. Text is drawn by the canvas, not by an image model, so every
 * move name is spelled exactly as saved.
 */
export async function renderCharacterCard(input: CharacterCardInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device could not create the card canvas.');

  const accent = input.accent ?? '#9b8afa';

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#0a0a10');
  background.addColorStop(0.55, '#0d0c14');
  background.addColorStop(1, '#101018');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(230, 40, 0, 230, 40, 780);
  glow.addColorStop(0, rgba(accent, 0.16));
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  roundRect(ctx, 28, 28, WIDTH - 56, HEIGHT - 56, 22);
  ctx.stroke();

  const art = input.art ? await loadImage(input.art).catch(() => null) : null;

  ctx.save();
  roundRect(ctx, ART.x, ART.y, ART.w, ART.h, 26);
  ctx.clip();
  if (art) {
    drawCover(ctx, art, ART);
    const leftFade = ctx.createLinearGradient(ART.x, 0, ART.x + 150, 0);
    leftFade.addColorStop(0, 'rgba(10, 10, 16, 0.85)');
    leftFade.addColorStop(1, 'rgba(10, 10, 16, 0)');
    ctx.fillStyle = leftFade;
    ctx.fillRect(ART.x, ART.y, 150, ART.h);

    const bottomFade = ctx.createLinearGradient(0, ART.y + ART.h - 170, 0, ART.y + ART.h);
    bottomFade.addColorStop(0, 'rgba(10, 10, 16, 0)');
    bottomFade.addColorStop(1, 'rgba(10, 10, 16, 0.72)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(ART.x, ART.y + ART.h - 170, ART.w, 170);
  } else {
    ctx.fillStyle = '#14141f';
    ctx.fillRect(ART.x, ART.y, ART.w, ART.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = ART.x - ART.h; x < ART.x + ART.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, ART.y + ART.h);
      ctx.lineTo(x + ART.h, ART.y);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240, 240, 246, 0.55)';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('NO CHARACTER ART YET', ART.x + ART.w / 2, ART.y + ART.h / 2);
    ctx.fillStyle = 'rgba(240, 240, 246, 0.32)';
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText(
      'Generate art, or save concept art to this project',
      ART.x + ART.w / 2,
      ART.y + ART.h / 2 + 32,
    );
    ctx.textAlign = 'left';
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  roundRect(ctx, ART.x, ART.y, ART.w, ART.h, 26);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = rgba(accent, 0.9);
  ctx.fillRect(LEFT - 34, 96, 4, 118);

  ctx.fillStyle = rgba(accent, 0.85);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('MOVESET // CHARACTER CARD', LEFT, 118);

  const name = (input.name || 'Untitled character').trim();
  ctx.fillStyle = INK;
  ctx.font = `700 64px ${FONT}`;
  const nameLines = wrapText(ctx, name, CONTENT, 2);
  let cursor = 198;
  for (const line of nameLines) {
    ctx.fillText(line, LEFT, cursor);
    cursor += 74;
  }

  const meta = [input.game?.trim(), input.theme?.trim()].filter(Boolean).join('   ·   ');
  if (meta) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(ellipsize(ctx, meta, CONTENT), LEFT, cursor + 4);
    cursor += 34;
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LEFT, cursor + 22);
  ctx.lineTo(LEFT + CONTENT, cursor + 22);
  ctx.stroke();

  const moves = input.moves.filter((move) => move.name.trim());
  const top = cursor + 74;
  const bottom = 868;
  const rowHeight = 58;
  const maxRows = Math.max(1, Math.floor((bottom - top) / rowHeight));
  const shown = moves.slice(0, maxRows);
  const hidden = moves.length - shown.length;

  if (shown.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText('No moves saved yet.', LEFT, top + 14);
  }

  shown.forEach((move, index) => {
    const rowY = top + index * rowHeight;

    ctx.fillStyle = rgba(accent, 0.8);
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(String(index + 1).padStart(2, '0'), LEFT, rowY + 22);

    const textX = LEFT + 52;
    let nameWidth = CONTENT - 52 - 12;
    const purpose = move.purpose?.trim() ?? '';

    if (purpose) {
      const label = purpose.toUpperCase();
      ctx.font = `600 12px ${FONT}`;
      const chipWidth = Math.min(214, ctx.measureText(label).width + 30);
      const chipX = LEFT + CONTENT - chipWidth;
      const chipY = rowY + 2;
      ctx.fillStyle = rgba(accent, 0.14);
      roundRect(ctx, chipX, chipY, chipWidth, 24, 12);
      ctx.fill();
      ctx.strokeStyle = rgba(accent, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(accent, 0.95);
      ctx.fillText(ellipsize(ctx, label, chipWidth - 26), chipX + 13, chipY + 17);
      nameWidth = CONTENT - 52 - chipWidth - 20;
    }

    ctx.fillStyle = INK;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(ellipsize(ctx, move.name.trim(), Math.max(60, nameWidth)), textX, rowY + 24);

    if (move.description?.trim()) {
      ctx.fillStyle = FAINT;
      ctx.font = `400 15px ${FONT}`;
      ctx.fillText(
        ellipsize(ctx, move.description.replace(/\s+/g, ' ').trim(), CONTENT - 52),
        textX,
        rowY + 46,
      );
    }
  });

  if (hidden > 0) {
    ctx.fillStyle = FAINT;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(
      `+${hidden} more move${hidden === 1 ? '' : 's'} — open the project to see ${hidden === 1 ? 'it' : 'them'}`,
      LEFT,
      bottom + 6,
    );
  }

  ctx.fillStyle = FAINT;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('MOVARYN · MOVESET STUDIO', LEFT, 944);

  const summary = `${moves.length} move${moves.length === 1 ? '' : 's'}   ·   ${new Date().toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  )}`;
  ctx.textAlign = 'right';
  ctx.fillText(summary, LEFT + CONTENT, 944);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
