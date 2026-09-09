'use strict';

const express = require('express');

const { getStore } = require('../store');
const { requireAuth, requireAdmin } = require('../auth');
const { validateClient } = require('../validation');

const router = express.Router();

router.use(requireAuth);

router.get('/', (_req, res) => {
  res.json({ clients: getStore().getAllClients() });
});

router.get('/:id', (req, res) => {
  const client = getStore().getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  return res.json({ client });
});

/**
 * Create or update a client.
 *
 * Body: `{ client, expectedUpdatedAt? }`. Sending `expectedUpdatedAt` from the copy
 * the user was editing turns a blind overwrite into a 409, which is what keeps three
 * people from clobbering each other.
 */
router.post('/', (req, res) => {
  const payload = req.body?.client ?? req.body;
  const { ok, fields, value } = validateClient(payload);
  if (!ok) {
    return res.status(400).json({ error: 'validation_failed', message: 'Please check the form.', fields });
  }

  const expectedUpdatedAt = req.body?.expectedUpdatedAt || null;
  const result = getStore().upsertClientChecked(value, expectedUpdatedAt);

  if (result.status === 'conflict') {
    return res.status(409).json({
      error: 'conflict',
      reason: result.reason,
      message:
        result.reason === 'deleted'
          ? 'Another user deleted this client while you were editing it.'
          : 'Another user changed this client while you were editing it.',
      client: result.client,
    });
  }

  return res.status(result.status === 'created' ? 201 : 200).json({
    client: result.client,
    status: result.status,
  });
});

/** Bulk import (JSON restore). Existing ids are skipped unless `skipExisting` is false. */
router.post('/bulk', (req, res) => {
  const incoming = Array.isArray(req.body?.clients) ? req.body.clients : null;
  if (!incoming) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Expected a clients array.' });
  }
  if (incoming.length > 20000) {
    return res.status(413).json({ error: 'too_many', message: 'Import is limited to 20000 clients at a time.' });
  }

  const skipExisting = req.body?.skipExisting !== false;
  const store = getStore();

  const accepted = [];
  const rejected = [];
  let skipped = 0;

  for (const raw of incoming) {
    const { ok, fields, value } = validateClient(raw);
    if (!ok) {
      rejected.push({ id: raw?.id ?? null, name: raw?.name ?? null, fields });
      continue;
    }
    if (skipExisting && store.getClient(value.id)) {
      skipped += 1;
      continue;
    }
    accepted.push(value);
  }

  if (accepted.length) store.upsertClients(accepted);

  return res.json({ added: accepted.length, skipped, rejected: rejected.length, details: rejected.slice(0, 20) });
});

router.delete('/:id', (req, res) => {
  const removed = getStore().deleteClient(req.params.id);
  if (!removed) return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  return res.json({ ok: true });
});

/** Destructive: wipes every client (and their payments, by cascade). */
router.delete('/', requireAdmin, (_req, res) => {
  getStore().clearClients();
  res.json({ ok: true });
});

module.exports = router;
