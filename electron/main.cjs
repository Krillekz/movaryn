const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { fork } = require('node:child_process');
const { app, BrowserWindow, dialog, session, shell } = require('electron');

const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';

let serverProcess = null;
let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function envFileCandidates() {
  return [
    path.join(app.getPath('userData'), 'provider.env'),
    path.join(app.getAppPath(), '.env'),
    path.join(process.cwd(), '.env'),
  ];
}

function waitForUrl(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Nothing answered at ${url}. Start the Vite dev server with "npm run dev:web".`));
          return;
        }
        setTimeout(attempt, 400);
      });
      request.setTimeout(2_000, () => request.destroy());
    };
    attempt();
  });
}

function startApi() {
  const entry = path.join(app.getAppPath(), 'server-dist', 'server', 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error(
      'The compiled API was not found. Run "npm run build" before launching the desktop app.',
    );
  }

  const envFile = envFileCandidates().find((candidate) => fs.existsSync(candidate));
  const child = fork(entry, [], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      // Development matches the Vite proxy; production picks a free loopback port.
      PORT: isDev ? '8787' : '0',
      MOVARYN_RANDOM_PORT: isDev ? '0' : '1',
      MOVARYN_ENV_FILE: envFile ?? '',
      MOVARYN_DATA_DIR: app.getPath('userData'),
      MOVARYN_STATIC_DIR: path.join(app.getAppPath(), 'dist'),
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  serverProcess = child;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('The local API did not start within 20 seconds.'));
    }, 20_000);

    let buffer = '';
    const onStdout = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const ready = line.match(/MOVARYN_READY (\{.+\})/);
        if (ready) {
          try {
            const parsed = JSON.parse(ready[1]);
            clearTimeout(timer);
            resolve(parsed.port);
            return;
          } catch {
            // keep waiting for a well-formed line
          }
        }
        if (line.trim()) console.log('[movaryn-api]', line.trim());
      }
    };

    child.stdout.on('data', onStdout);
    child.stderr.on('data', (chunk) => console.error('[movaryn-api]', chunk.toString().trim()));
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`The local API exited unexpectedly (code ${code}).`));
      }
    });
  });
}

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#08080b',
    title: 'Movaryn',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  const targetOrigin = new URL(url).origin;

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
    if (/^https?:\/\//i.test(externalUrl)) void shell.openExternal(externalUrl);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin === targetOrigin) return;
    } catch {
      // fall through and block
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(navigationUrl)) void shell.openExternal(navigationUrl);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  try {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });

    if (isDev) {
      await waitForUrl(DEV_URL);
    }
    const port = await startApi();
    const url = isDev ? DEV_URL : `http://127.0.0.1:${port}/`;
    await createWindow(url);
  } catch (error) {
    dialog.showErrorBox('Movaryn could not start', String(error && error.message ? error.message : error));
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    void createWindow(isDev ? DEV_URL : 'http://127.0.0.1:8787/');
  }
});
