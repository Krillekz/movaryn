declare module 'jpeg-js' {
  interface RawImage {
    data: Uint8Array;
    width: number;
    height: number;
  }

  interface DecodeOptions {
    useTArray?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  }

  function decode(data: Buffer | Uint8Array, options?: DecodeOptions): RawImage;
  function encode(image: RawImage, quality?: number): { data: Buffer; width: number; height: number };

  const jpeg: { decode: typeof decode; encode: typeof encode };
  export = jpeg;
}
