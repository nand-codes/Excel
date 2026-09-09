-- Excel Driving School — application database (SQLite)
-- Used by db/clientStore.js via Node.js built-in node:sqlite (DatabaseSync).
-- This file is a readable reference; the runtime schema is applied by clientStore.js.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT,               -- bumped on every write; used for conflict detection
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

-- Staff accounts. Created only through `npm run user:add`; there is no self-signup.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,   -- bcrypt
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- Opaque login sessions. Only the SHA-256 hash of the token is stored, so a
-- database leak cannot be replayed as a valid cookie.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
