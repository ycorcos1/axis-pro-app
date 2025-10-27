/**
 * Preload script for secure IPC communication
 * @mem ref: arch-fwk
 * Exposes safe APIs to the renderer process
 */

import { contextBridge } from 'electron';

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future IPC handlers
  platform: process.platform,
});

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      platform: string;
    };
  }
}

