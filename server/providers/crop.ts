import jpeg from 'jpeg-js';
import type { AspectRatio } from '../../shared/types';

const RATIOS: Record<AspectRatio, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
};

/** Ratios closer than this are treated as already correct. */
const EPSILON = 0.01;

/**
 * Share of the crop height left empty above the highest detected detail. Art
 * with a subject pinned to the very top edge looks cramped, and faces are the
 * part viewers notice when a crop is slightly off.
 */
const HEADROOM = 0.06;

/** A row or column counts as subject detail once it reaches this share of the busiest one. */
const DETAIL_THRESHOLD = 0.12;

/** Radius, in pixels, of the smoothing pass applied to the detail profiles. */
const SMOOTH_RADIUS = 2;

type Decoded = { data: Uint8Array; width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/** Per-pixel luminance, used because detail is judged on brightness changes, not colour. */
function toLuma(data: Uint8Array, pixels: number): Float32Array {
  const luma = new Float32Array(pixels);
  for (let index = 0, offset = 0; index < pixels; index += 1, offset += 4) {
    luma[index] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  }
  return luma;
}

function smooth(profile: Float64Array, radius: number): Float64Array {
  if (radius <= 0) return profile;
  const output = new Float64Array(profile.length);
  for (let index = 0; index < profile.length; index += 1) {
    const start = Math.max(0, index - radius);
    const end = Math.min(profile.length - 1, index + radius);
    let total = 0;
    for (let cursor = start; cursor <= end; cursor += 1) total += profile[cursor];
    output[index] = total / (end - start + 1);
  }
  return output;
}

/**
 * Sums local brightness gradients per row and per column. Flat sky and empty
 * backdrop contribute almost nothing, while faces, silhouettes and props stand
 * out, which is enough to find where the subject actually is.
 */
function detailProfiles(decoded: Decoded): { rows: Float64Array; cols: Float64Array } {
  const { data, width, height } = decoded;
  const luma = toLuma(data, width * height);
  const rows = new Float64Array(height);
  const cols = new Float64Array(width);

  for (let y = 1; y < height - 1; y += 1) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const index = rowOffset + x;
      const energy = Math.abs(luma[index + 1] - luma[index - 1]) + Math.abs(luma[index + width] - luma[index - width]);
      rows[y] += energy;
      cols[x] += energy;
    }
  }

  return { rows: smooth(rows, SMOOTH_RADIUS), cols: smooth(cols, SMOOTH_RADIUS) };
}

/** First and last row (or column) that still carries subject detail. */
function contentSpan(profile: Float64Array): { start: number; end: number } | null {
  let peak = 0;
  for (const value of profile) if (value > peak) peak = value;
  if (peak <= 0) return null;

  const threshold = peak * DETAIL_THRESHOLD;
  let start = 0;
  while (start < profile.length && profile[start] < threshold) start += 1;
  if (start >= profile.length) return null;

  let end = profile.length - 1;
  while (end > start && profile[end] < threshold) end -= 1;
  return { start, end };
}

/**
 * Picks the crop offset for one axis.
 *
 * `leadBias` is where the leading edge of the subject should land inside the
 * window, as a share of the crop size. Vertically we pass a small value so the
 * subject keeps its headroom and any overflow is cut from the bottom; for
 * columns we pass half, which centres the subject horizontally.
 */
function axisOffset(
  span: { start: number; end: number } | null,
  cropSize: number,
  fullSize: number,
  leadBias: number,
): number {
  const maximum = Math.max(0, fullSize - cropSize);
  if (!span) return Math.floor(maximum / 2);

  const spanSize = span.end - span.start + 1;
  const offset =
    spanSize <= cropSize
      ? span.start - (cropSize - spanSize) / 2
      : span.start - leadBias * cropSize;
  return clamp(Math.round(offset), 0, maximum);
}

/**
 * Crops a JPEG to the requested aspect ratio, following the subject.
 *
 * FLUX.1 schnell only emits square images, so a portrait or wide brief would
 * otherwise be letterboxed by the UI. A plain centre crop slices the top of a
 * head off in wide frames, so the crop is placed using brightness-gradient
 * profiles: vertically the subject keeps `HEADROOM` above it and surplus is
 * taken from the bottom, horizontally it is centred.
 *
 * Returns the original buffer when it already matches, when it cannot be
 * decoded as JPEG, or when cropping changes nothing. The single re-encode runs
 * at high quality to keep artefacts low.
 */
export function cropJpegToAspect(buffer: Buffer, aspect: AspectRatio): Buffer {
  const target = RATIOS[aspect];
  if (!target) return buffer;

  let decoded: Decoded;
  try {
    decoded = jpeg.decode(buffer, { useTArray: true });
  } catch {
    return buffer;
  }

  const { width, height, data } = decoded;
  if (!width || !height) return buffer;
  if (Math.abs(width / height - target) < EPSILON) return buffer;

  let cropWidth = width;
  let cropHeight = height;
  if (width / height > target) {
    cropWidth = Math.round(height * target);
  } else {
    cropHeight = Math.round(width / target);
  }
  // Keep dimensions even; some encoders handle odd sizes poorly.
  cropWidth = Math.min(width, Math.max(2, cropWidth - (cropWidth % 2)));
  cropHeight = Math.min(height, Math.max(2, cropHeight - (cropHeight % 2)));
  if (cropWidth === width && cropHeight === height) return buffer;

  let top = Math.floor((height - cropHeight) / 2);
  let left = Math.floor((width - cropWidth) / 2);
  if (cropHeight < height || cropWidth < width) {
    const { rows, cols } = detailProfiles(decoded);
    if (cropHeight < height) top = axisOffset(contentSpan(rows), cropHeight, height, HEADROOM);
    if (cropWidth < width) left = axisOffset(contentSpan(cols), cropWidth, width, 0.5);
  }

  const out = Buffer.alloc(cropWidth * cropHeight * 4);
  const source = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const rowBytes = cropWidth * 4;

  for (let row = 0; row < cropHeight; row += 1) {
    const start = ((top + row) * width + left) * 4;
    source.copy(out, row * rowBytes, start, start + rowBytes);
  }

  const encoded = jpeg.encode({ data: out, width: cropWidth, height: cropHeight }, 92);
  return Buffer.from(encoded.data);
}
