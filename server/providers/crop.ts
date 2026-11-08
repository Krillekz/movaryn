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
 * Center-crops a JPEG to the requested aspect ratio.
 *
 * FLUX.1 schnell only emits square images, so a portrait or wide brief would
 * otherwise be letterboxed by the UI. Returns the original buffer when it
 * already matches, when it cannot be decoded as JPEG, or when cropping changes
 * nothing. The single re-encode runs at high quality to keep artefacts low.
 */
export function cropJpegToAspect(buffer: Buffer, aspect: AspectRatio): Buffer {
  const target = RATIOS[aspect];
  if (!target) return buffer;

  let decoded: { data: Uint8Array; width: number; height: number };
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

  const left = Math.floor((width - cropWidth) / 2);
  const top = Math.floor((height - cropHeight) / 2);
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
