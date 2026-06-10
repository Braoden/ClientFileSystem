const { contextBridge } = require('electron');

// Expose a minimal API surface to the renderer process.
// All real communication goes through the Node.js backend via fetch().
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
