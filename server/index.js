'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { getStore, closeStore } = require('./store');

const store = getStore();

if (store.countUsers() === 0) {
  console.warn(
    '[api] No user accounts exist yet — nobody can sign in.\n' +
      '      Create one with:  npm run user:add -- --username admin --role admin'
  );
}

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`[api] listening on http://${config.host}:${config.port}`);
  console.log(`[api] database: ${store.getDbFilePath()}`);
  console.log(`[api] serving web build from: ${config.webDist}`);
});

// Expired sessions accumulate slowly; sweep them once a day.
const sessionSweep = setInterval(() => {
  try {
    store.deleteExpiredSessions();
  } catch (err) {
    console.error('[api] session cleanup failed:', err.message || err);
  }
}, 24 * 60 * 60 * 1000);
sessionSweep.unref();

function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  clearInterval(sessionSweep);
  server.close(() => {
    closeStore();
    process.exit(0);
  });
  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
