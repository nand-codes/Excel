'use strict';

const path = require('path');

function readBool(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';
const projectRoot = path.join(__dirname, '..');

const config = {
  isProduction,
  port: readInt(process.env.PORT, 4000),
  host: process.env.HOST || '0.0.0.0',

  /** SQLite file. On the server this points at a path outside the deploy directory. */
  dbPath: process.env.EXCEL_DB_PATH
    ? path.resolve(process.env.EXCEL_DB_PATH)
    : path.join(projectRoot, 'data', 'clients.sqlite'),

  /** Built React app. Missing in development, where Vite serves the UI instead. */
  webDist: process.env.EXCEL_WEB_DIST
    ? path.resolve(process.env.EXCEL_WEB_DIST)
    : path.join(projectRoot, 'web', 'dist'),

  sessionDays: readInt(process.env.EXCEL_SESSION_DAYS, 30),
  cookieName: process.env.EXCEL_COOKIE_NAME || 'eds_session',

  /** Required for cookies over HTTPS; disabled by default in development. */
  secureCookies: readBool(process.env.EXCEL_SECURE_COOKIES, isProduction),

  /** Needed behind Caddy so rate limiting sees the real client IP. */
  trustProxy: readBool(process.env.EXCEL_TRUST_PROXY, isProduction),

  /** Only needed if the UI is served from a different origin than the API. */
  corsOrigin: process.env.EXCEL_CORS_ORIGIN || '',

  loginAttemptsPerWindow: readInt(process.env.EXCEL_LOGIN_ATTEMPTS, 10),
  loginWindowMinutes: readInt(process.env.EXCEL_LOGIN_WINDOW_MINUTES, 15),
};

module.exports = config;
