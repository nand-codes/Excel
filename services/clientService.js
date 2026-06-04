'use strict';

(function attachClientService() {
  const api = window.clientDbApi;

  if (!api) {
    throw new Error('clientDbApi bridge not available. Check preload configuration.');
  }

  window.clientService = {
    getAll: () => api.getClients(),
    getDbPath: () => api.getDbPath(),
    upsert: (client) => api.upsertClient(client),
    upsertMany: (clients) => api.upsertClients(clients),
    remove: (id) => api.deleteClient(id),
    clearAll: () => api.clearClients(),
    saveSqliteBackup: () => api.saveSqliteBackup(),
    restoreSqliteBackup: () => api.restoreSqliteBackup(),
  };
})();
