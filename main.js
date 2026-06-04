const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClientStore } = require('./db/clientStore');

// Force a dedicated writable session cache path to avoid Windows cache move permission errors.
const sessionDataPath = path.join(app.getPath('userData'), 'session-data');
app.setPath('sessionData', sessionDataPath);
app.commandLine.appendSwitch('disk-cache-dir', path.join(sessionDataPath, 'Cache'));

// Keep a global reference to prevent garbage collection
let mainWindow;
let clientStore;
/** Active SQLite file path (same value passed to createClientStore). */
let dbFilePath;

function registerClientIpcHandlers() {
  ipcMain.handle('clients:getAll', () => clientStore.getAllClients());

  ipcMain.handle('clients:getDbPath', () => clientStore.getDbFilePath());

  ipcMain.handle('clients:upsertOne', (_event, client) => {
    clientStore.upsertClient(client);
    return true;
  });

  ipcMain.handle('clients:upsertMany', (_event, clients) => {
    clientStore.upsertClients(clients);
    return true;
  });

  ipcMain.handle('clients:delete', (_event, id) => {
    clientStore.deleteClient(id);
    return true;
  });

  ipcMain.handle('clients:clear', () => {
    clientStore.clearClients();
    return true;
  });
}

function isSqliteDatabaseFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(16);
      const n = fs.readSync(fd, buf, 0, 16, 0);
      if (n < 15) return false;
      return buf.subarray(0, 15).equals(Buffer.from('SQLite format 3'));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

function registerBackupHandlers() {
  ipcMain.handle('backup:saveSqlite', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!clientStore) return { ok: false, error: 'Database not ready.' };

    const livePath = path.resolve(clientStore.getDbFilePath());
    const suggested = path.join(
      app.getPath('documents'),
      `ExcelDS_clients_${new Date().toISOString().slice(0, 10)}.sqlite`
    );

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save SQLite backup',
      defaultPath: suggested,
      filters: [{ name: 'SQLite database', extensions: ['sqlite'] }],
      properties: ['showOverwriteConfirmation'],
    });

    if (canceled || !filePath) return { ok: false, cancelled: true };

    const dest = path.resolve(filePath);
    if (dest === livePath) {
      return { ok: false, error: 'Pick a different file than the live database.' };
    }

    try {
      clientStore.vacuumInto(dest);
      return { ok: true, path: dest };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('backup:restoreSqlite', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!dbFilePath) return { ok: false, error: 'Database path not configured.' };

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select SQLite backup to restore',
      filters: [
        { name: 'SQLite backup', extensions: ['sqlite', 'db'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || !filePaths[0]) return { ok: false, cancelled: true };

    const src = path.resolve(filePaths[0]);
    const live = path.resolve(dbFilePath);

    if (src === live) {
      return { ok: false, error: 'Choose a backup file, not the live database path.' };
    }

    if (!isSqliteDatabaseFile(src)) {
      return { ok: false, error: 'That file is not a valid SQLite database.' };
    }

    try {
      clientStore.close();
      clientStore = null;
      for (const suffix of ['-wal', '-shm']) {
        const sidecar = live + suffix;
        try {
          if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
        } catch {
          /* ignore */
        }
      }
      fs.copyFileSync(src, live);
      clientStore = createClientStore(live);
      return { ok: true };
    } catch (err) {
      try {
        clientStore = createClientStore(live);
      } catch {
        /* leave broken state surfaced to user */
      }
      return { ok: false, error: err.message || String(err) };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Excel Driving School — Client Management',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0D1B2A',
    show: false, // Show after ready-to-show to avoid white flash
    autoHideMenuBar: true,
  });

  // Load the existing index.html
  mainWindow.loadFile('index.html');

  // Show window when ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    if (process.env.EXCEL_MEASURE_STARTUP === '1') {
      try {
        fs.writeFileSync(
          path.join(os.tmpdir(), 'excel-ds-ready.signal'),
          String(Date.now()),
          'utf8'
        );
      } catch {
        /* ignore */
      }
    }
    mainWindow.show();
  });

  // Build a simple application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.executeJavaScript("navigate('dashboard', document.querySelector('[data-page=dashboard]'))"),
        },
        {
          label: 'Clients',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.executeJavaScript("navigate('clients', document.querySelector('[data-page=clients]'))"),
        },
        {
          label: 'Add Client',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.executeJavaScript("navigate('add', document.querySelector('[data-page=add]'))"),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Excel Driving School',
          click: () => mainWindow.webContents.executeJavaScript("navigate('settings', document.querySelector('[data-page=settings]'))"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Packaged app: DB under userData (writable install location).
  // Dev (npm start): DB in ./data next to the app — stays inside the project folder.
  dbFilePath = app.isPackaged
    ? path.join(app.getPath('userData'), 'data', 'clients.sqlite')
    : path.join(__dirname, 'data', 'clients.sqlite');
  clientStore = createClientStore(dbFilePath);
  registerClientIpcHandlers();
  registerBackupHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (clientStore) {
    clientStore.close();
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
