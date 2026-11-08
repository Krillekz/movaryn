const { contextBridge } = require('electron');

// Minimal, read-only bridge. No filesystem, no IPC, no provider keys.
contextBridge.exposeInMainWorld(
  'movarynDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform || 'unknown',
    version: process.versions.electron || '',
  }),
);
