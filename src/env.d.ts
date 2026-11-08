/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  movarynDesktop?: {
    isDesktop: true;
    version: string;
    platform: string;
  };
}
