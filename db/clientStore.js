'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function optionalText(value, maxLength) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

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
    guardianName: optionalText(client.guardianName, 120),
    applicationNumber: optionalText(client.applicationNumber, 64),
    alternatePhone: optionalText(client.alternatePhone, 15),
  };
}

function normalizePayment(payment) {
  return {
    id: String(payment.id),
    clientId: String(payment.clientId),
    amount: Number(payment.amount) || 0,
    paidAt: payment.paidAt || new Date().toISOString(),
    method: optionalText(payment.method, 40),
    note: optionalText(payment.note, 500),
  };
}

function createClientStore(dbFilePath) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

  const db = new DatabaseSync(dbFilePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      dob TEXT,
      blood_group TEXT,
      licence_type TEXT,
      address TEXT NOT NULL,
      guardian_name TEXT,
      application_number TEXT,
      alternate_phone TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL,
      method TEXT,
      note TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  /** Adds a column to an existing database created by an older version. */
  function ensureColumn(table, column, definition) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((col) => col.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      return true;
    }
    return false;
  }

  ensureColumn('clients', 'guardian_name', 'TEXT');
  ensureColumn('clients', 'alternate_phone', 'TEXT');
  ensureColumn('clients', 'application_number', 'TEXT');
  if (ensureColumn('clients', 'updated_at', 'TEXT')) {
    db.exec('UPDATE clients SET updated_at = created_at WHERE updated_at IS NULL');
  }

  const CLIENT_COLUMNS = `
      id,
      created_at AS createdAt,
      updated_at AS updatedAt,
      name,
      phone,
      dob,
      blood_group AS bloodGroup,
      licence_type AS licenceType,
      address,
      guardian_name AS guardianName,
      application_number AS applicationNumber,
      alternate_phone AS alternatePhone`;

  const selectAllStmt = db.prepare(`
    SELECT ${CLIENT_COLUMNS}
    FROM clients
    ORDER BY created_at ASC
  `);

  const selectOneStmt = db.prepare(`
    SELECT ${CLIENT_COLUMNS}
    FROM clients
    WHERE id = ?
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO clients (
      id, created_at, updated_at, name, phone, dob, blood_group, licence_type,
      address, guardian_name, application_number, alternate_phone
    ) VALUES (
      $id, $createdAt, $updatedAt, $name, $phone, $dob, $bloodGroup, $licenceType,
      $address, $guardianName, $applicationNumber, $alternatePhone
    )
    ON CONFLICT(id) DO UPDATE SET
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      name = excluded.name,
      phone = excluded.phone,
      dob = excluded.dob,
      blood_group = excluded.blood_group,
      licence_type = excluded.licence_type,
      address = excluded.address,
      guardian_name = excluded.guardian_name,
      application_number = excluded.application_number,
      alternate_phone = excluded.alternate_phone
  `);

  const deleteStmt = db.prepare('DELETE FROM clients WHERE id = ?');
  const clearStmt = db.prepare('DELETE FROM clients');

  const insertPaymentStmt = db.prepare(`
    INSERT INTO payments (id, client_id, amount, paid_at, method, note)
    VALUES ($id, $clientId, $amount, $paidAt, $method, $note)
  `);

  const selectPaymentsByClientStmt = db.prepare(`
    SELECT
      id,
      client_id AS clientId,
      amount,
      paid_at AS paidAt,
      method,
      note
    FROM payments
    WHERE client_id = ?
    ORDER BY paid_at DESC
  `);

  const sumPaymentsByClientStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE client_id = ?
  `);

  const deletePaymentStmt = db.prepare('DELETE FROM payments WHERE id = ?');
  const selectPaymentStmt = db.prepare(`
    SELECT id, client_id AS clientId, amount, paid_at AS paidAt, method, note
    FROM payments
    WHERE id = ?
  `);

  const insertUserStmt = db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, role, created_at)
    VALUES ($id, $username, $displayName, $passwordHash, $role, $createdAt)
  `);

  const USER_COLUMNS = `
      id,
      username,
      display_name AS displayName,
      password_hash AS passwordHash,
      role,
      created_at AS createdAt,
      last_login_at AS lastLoginAt`;

  const selectUserByNameStmt = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`);
  const selectUserByIdStmt = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`);
  const listUsersStmt = db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at ASC`);
  const countUsersStmt = db.prepare('SELECT COUNT(*) AS count FROM users');
  const updateUserPasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  const touchUserLoginStmt = db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');

  const insertSessionStmt = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES ($tokenHash, $userId, $createdAt, $expiresAt)
  `);

  const selectSessionStmt = db.prepare(`
    SELECT
      s.token_hash AS tokenHash,
      s.expires_at AS expiresAt,
      u.id AS id,
      u.username AS username,
      u.display_name AS displayName,
      u.role AS role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `);

  const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const deleteUserSessionsStmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const deleteExpiredSessionsStmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

  /**
   * Write a consistent snapshot of this database to another file (safe while the app is running).
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

    getClient(id) {
      return selectOneStmt.get(String(id)) || null;
    },

    upsertClient(client) {
      const row = normalizeClient(client);
      upsertStmt.run({ ...row, updatedAt: new Date().toISOString() });
    },

    /**
     * Upsert with optimistic concurrency. `expectedUpdatedAt` is the value the caller
     * last read; when it no longer matches, another user has edited the record.
     *
     * @returns {{status: 'created'|'updated'|'conflict', reason?: 'stale'|'deleted', client: object|null}}
     */
    upsertClientChecked(client, expectedUpdatedAt) {
      const row = normalizeClient(client);
      const existing = selectOneStmt.get(row.id);

      if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
        return { status: 'conflict', reason: 'stale', client: existing };
      }

      // An edit of a row that has since been deleted would silently resurrect it.
      if (!existing && expectedUpdatedAt) {
        return { status: 'conflict', reason: 'deleted', client: null };
      }

      // Creation time is owned by the first write; later writes cannot rewrite history.
      const createdAt = existing ? existing.createdAt : row.createdAt;
      upsertStmt.run({ ...row, createdAt, updatedAt: new Date().toISOString() });

      return {
        status: existing ? 'updated' : 'created',
        client: selectOneStmt.get(row.id),
      };
    },

    upsertClients(clients) {
      if (!Array.isArray(clients) || !clients.length) return 0;
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        for (const raw of clients) {
          const row = normalizeClient(raw);
          const existing = selectOneStmt.get(row.id);
          upsertStmt.run({
            ...row,
            createdAt: existing ? existing.createdAt : row.createdAt,
            updatedAt: now,
          });
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return clients.length;
    },

    deleteClient(id) {
      const result = deleteStmt.run(String(id));
      return result.changes > 0;
    },

    clearClients() {
      clearStmt.run();
    },

    addPayment(payment) {
      insertPaymentStmt.run(normalizePayment(payment));
    },

    getPayment(id) {
      return selectPaymentStmt.get(String(id)) || null;
    },

    getPaymentsByClient(clientId) {
      return selectPaymentsByClientStmt.all(String(clientId));
    },

    getPaymentTotal(clientId) {
      const row = sumPaymentsByClientStmt.get(String(clientId));
      return row ? row.total : 0;
    },

    deletePayment(id) {
      const result = deletePaymentStmt.run(String(id));
      return result.changes > 0;
    },

    // ── Users ────────────────────────────────────────────────────
    createUser({ id, username, displayName, passwordHash, role, createdAt }) {
      insertUserStmt.run({
        id: String(id),
        username: String(username).trim().toLowerCase(),
        displayName: optionalText(displayName, 80),
        passwordHash: String(passwordHash),
        role: role === 'admin' ? 'admin' : 'staff',
        createdAt: createdAt || new Date().toISOString(),
      });
    },

    getUserByUsername(username) {
      return selectUserByNameStmt.get(String(username || '').trim().toLowerCase()) || null;
    },

    getUserById(id) {
      return selectUserByIdStmt.get(String(id)) || null;
    },

    listUsers() {
      return listUsersStmt.all().map(({ passwordHash, ...safe }) => safe);
    },

    countUsers() {
      const row = countUsersStmt.get();
      return row ? row.count : 0;
    },

    updateUserPassword(id, passwordHash) {
      const result = updateUserPasswordStmt.run(String(passwordHash), String(id));
      return result.changes > 0;
    },

    touchUserLogin(id) {
      touchUserLoginStmt.run(new Date().toISOString(), String(id));
    },

    deleteUser(id) {
      const result = deleteUserStmt.run(String(id));
      return result.changes > 0;
    },

    // ── Sessions ─────────────────────────────────────────────────
    createSession({ tokenHash, userId, expiresAt }) {
      insertSessionStmt.run({
        tokenHash: String(tokenHash),
        userId: String(userId),
        createdAt: new Date().toISOString(),
        expiresAt: String(expiresAt),
      });
    },

    getSession(tokenHash) {
      return selectSessionStmt.get(String(tokenHash)) || null;
    },

    deleteSession(tokenHash) {
      deleteSessionStmt.run(String(tokenHash));
    },

    deleteSessionsForUser(userId) {
      deleteUserSessionsStmt.run(String(userId));
    },

    deleteExpiredSessions() {
      const result = deleteExpiredSessionsStmt.run(new Date().toISOString());
      return result.changes;
    },

    close() {
      db.close();
    },

    vacuumInto,
  };
}

module.exports = { createClientStore, normalizeClient, normalizePayment };
