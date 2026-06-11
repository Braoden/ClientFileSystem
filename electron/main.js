const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function waitForBackend(url, onReady, attempt = 0, maxAttempts = 40) {
  const req = http.get(url, () => onReady());
  req.on('error', () => {
    if (attempt < maxAttempts) {
      setTimeout(() => waitForBackend(url, onReady, attempt + 1, maxAttempts), 500);
    } else {
      onReady();
    }
  });
}

function createWindow(isDev) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Client File System',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    waitForBackend('http://localhost:3001', () => {
      mainWindow.loadURL('http://localhost:3001');
    });
  }
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;

  if (!isDev) {
    try {
      process.env.DATA_DIR = app.getPath('userData');
      process.env.FRONTEND_BUILD_PATH = path.join(process.resourcesPath, 'frontend', 'build');
      // Load from the ASAR bundle — guaranteed to include backend/node_modules.
      require(path.join(app.getAppPath(), 'backend', 'server.js'));
    } catch (err) {
      console.error('Backend failed to start:', err);
    }
  }

  createWindow(isDev);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(isDev);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
