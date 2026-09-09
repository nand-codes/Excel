'use strict';

const { createClientStore } = require('../db/clientStore');
const config = require('./config');

let store = null;

/** Opens the database once per process and reuses it for every request. */
function getStore() {
  if (!store) {
    store = createClientStore(config.dbPath);
    store.deleteExpiredSessions();
  }
  return store;
}

function closeStore() {
  if (store) {
    store.close();
    store = null;
  }
}

module.exports = { getStore, closeStore };
