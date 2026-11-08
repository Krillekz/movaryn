import type { ImageRequest, ImageResponse } from '../../shared/types';
import { config } from '../config';
import { generateCloudflareImage } from './cloudflare';
import { generateOpenAIImage } from './openai';

/** Single entry point for /api/image; the backend is chosen by IMAGE_PROVIDER. */
export function generateImage(input: ImageRequest): Promise<ImageResponse> {
  return config.image.provider === 'cloudflare'
    ? generateCloudflareImage(input)
    : generateOpenAIImage(input);
}
