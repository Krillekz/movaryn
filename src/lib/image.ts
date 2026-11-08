import type { ImageAttachment } from '../../shared/types';
import { uid } from './utils';

const MAX_DIMENSION = 1536;
const MAX_DATA_LENGTH = 1_700_000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not a readable image.'));
    image.src = dataUrl;
  });
}

function downscale(image: HTMLImageElement): { dataUrl: string; width: number; height: number } {
  const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
  const ratio = Math.min(1, MAX_DIMENSION / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return { dataUrl: image.src, width, height };
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height };
}

/**
 * Reads an uploaded image, downscaling large files so conversations stay
 * reasonable in IndexedDB and requests stay under provider limits.
 */
export async function readImageFile(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That image is larger than 12 MB. Use a smaller reference.');
  }

  const original = await readAsDataUrl(file);
  const image = await loadImage(original);
  const withinSize =
    original.length <= MAX_DATA_LENGTH &&
    Math.max(image.naturalWidth, image.naturalHeight) <= MAX_DIMENSION;

  if (withinSize) {
    return {
      id: uid('ref'),
      name: file.name || 'reference.png',
      dataUrl: original,
      width: image.naturalWidth,
      height: image.naturalHeight,
      size: file.size,
    };
  }

  const scaled = downscale(image);
  return {
    id: uid('ref'),
    name: file.name || 'reference.jpg',
    dataUrl: scaled.dataUrl,
    width: scaled.width,
    height: scaled.height,
    size: file.size,
  };
}
