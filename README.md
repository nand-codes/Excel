# Excel Driving School — Client Manager

Electron desktop app for managing driving-school clients.

## Local database (SQL)

Client records are stored in **SQLite** using Node’s built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) module (`DatabaseSync`).

| Run mode | Database file |
|----------|----------------|
| **Development** (`npm start`) | `<project>/data/clients.sqlite` |
| **Packaged** (installer / portable build) | `<userData>/data/clients.sqlite` (Electron app user data directory) |

Schema and indexes are defined in [`db/schema.sql`](db/schema.sql) (reference) and applied at runtime in [`db/clientStore.js`](db/clientStore.js).

The **Settings → About** screen shows the resolved absolute path while the app is running.

### Backup and restore (SQLite)

Under **Settings → Data Management**:

- **Backup .sqlite** — Windows save dialog; choose any folder or removable drive. Uses SQLite `VACUUM INTO` so the snapshot is consistent while the app is running.
- **Restore .sqlite** — Pick a previously saved `.sqlite` file; the app validates the SQLite header, replaces the live database, and reloads data (current data is overwritten).

JSON export/import is still available for spreadsheet-oriented workflows; the `.sqlite` backup is the **complete** database file.

### Requirements

- **Node.js 22+** (for `node:sqlite` in the main process). Use an Electron release whose bundled Node supports `node:sqlite` (this project targets Electron **42.x**).

### Commands

```bash
npm install
npm start
```

### Build a Windows `.exe` (portable)

```bash
npm run dist
```

Output: **`dist/ExcelDrivingSchool.exe`** — a single portable executable you can copy anywhere and run (no separate installer). Your **client data** is stored under `%APPDATA%\excel-driving-school\data\clients.sqlite` (see **Settings → About** for the exact path).

This repo sets `build.win.signAndEditExecutable` to `false` so packaging works on Windows without extra symlink privileges for signing tools.

### Packaged app and SQLite

- The **SQLite engine** is included with the Electron runtime inside the app — you do **not** install SQL Server or any separate database product.
- The **`clients.sqlite` file** is **not** embedded in the `.exe`; it is **created on first run** in the user data folder so data persists and the download stays a normal app size.

### Startup / performance notes

- **Cold start** is dominated by launching Chromium + Electron, then loading HTML/CSS/JS — that is normal for desktop web apps.
- This repo trims **intro animation** duration, avoids a **duplicate sidebar animation** override, loads **fewer Google Font weights**, defers the **DB path** IPC until the browser is idle, and binds **client table sorting** only when you open the Clients page.

If the dataset grows very large (thousands of rows), the next step would be **pagination** or virtual scrolling on the clients table and **lazy charts** on Reports.
