'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function normalizeClient(client) {
  return {
    id: String(client.id),
    createdAt: client.createdAt || new Date().toISOString(),
    name: String(client.name || '').trim(),
    phone: String(client.phone || '').trim(),
    dob: client.dob || null,
    bloodGroup: client.bloodGroup || null,
    licenceType: client.licenceType || null,
    address: String(client.address || '').trim(),
  };
}

function createClientStore(dbFilePath) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

  const db = new DatabaseSync(dbFilePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      dob TEXT,
      blood_group TEXT,
      licence_type TEXT,
      address TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);
  `);

  const selectAllStmt = db.prepare(`
    SELECT
      id,
      created_at AS createdAt,
      name,
      phone,
      dob,
      blood_group AS bloodGroup,
      licence_type AS licenceType,
      address
    FROM clients
    ORDER BY created_at ASC
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO clients (
      id, created_at, name, phone, dob, blood_group, licence_type, address
    ) VALUES (
      $id, $createdAt, $name, $phone, $dob, $bloodGroup, $licenceType, $address
    )
    ON CONFLICT(id) DO UPDATE SET
      created_at = excluded.created_at,
      name = excluded.name,
      phone = excluded.phone,
      dob = excluded.dob,
      blood_group = excluded.blood_group,
      licence_type = excluded.licence_type,
      address = excluded.address
  `);

  const deleteStmt = db.prepare('DELETE FROM clients WHERE id = ?');
  const clearStmt = db.prepare('DELETE FROM clients');

  /**
   * Write a consistent snapshot of this database to another file (safe while app is running).
   * Uses SQLite VACUUM INTO (requires SQLite 3.27+).
   */
  function vacuumInto(destPath) {
    const abs = path.resolve(destPath);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
    const sqlPath = abs.replace(/\\/g, '/').replace(/'/g, "''");
    db.exec(`VACUUM INTO '${sqlPath}'`);
  }

  return {
    /** Absolute path to the SQLite file (for display / backup). */
    getDbFilePath() {
      return dbFilePath;
    },

    getAllClients() {
      return selectAllStmt.all();
    },

    upsertClient(client) {
      upsertStmt.run(normalizeClient(client));
    },

    upsertClients(clients) {
      if (!Array.isArray(clients) || !clients.length) return;
      db.exec('BEGIN');
      try {
        for (const row of clients) {
          const client = normalizeClient(row);
          upsertStmt.run(client);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    deleteClient(id) {
      deleteStmt.run(id);
    },

    clearClients() {
      clearStmt.run();
    },

    close() {
      db.close();
    },

    vacuumInto,
  };
}

module.exports = { createClientStore };
