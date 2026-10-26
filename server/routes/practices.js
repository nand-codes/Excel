'use strict';

const express = require('express');

const { getStore } = require('../store');
const { requireAuth } = require('../auth');
const { validatePractice } = require('../validation');

const router = express.Router();

router.use(requireAuth);

router.get('/clients/:id/practices', (req, res) => {
  const store = getStore();
  if (!store.getClient(req.params.id)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }
  return res.json({ practices: store.getPracticesByClient(req.params.id) });
});

router.post('/practices', (req, res) => {
  const { ok, fields, value } = validatePractice(req.body?.practice ?? req.body);
  if (!ok) {
    return res.status(400).json({ error: 'validation_failed', message: 'Please check the practice details.', fields });
  }

  const store = getStore();
  if (!store.getClient(value.clientId)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }

  store.addPractice({ ...value, createdBy: req.user.displayName || req.user.username });
  return res.status(201).json({ practice: store.getPractice(value.id) });
});

router.delete('/practices/:id', (req, res) => {
  const store = getStore();
  const practice = store.getPractice(req.params.id);
  if (!practice) return res.status(404).json({ error: 'not_found', message: 'Practice session not found.' });

  store.deletePractice(req.params.id);
  return res.json({ ok: true, clientId: practice.clientId });
});

module.exports = router;
