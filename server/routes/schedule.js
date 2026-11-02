'use strict';

const express = require('express');
const { getStore } = require('../store');
const { requireAuth } = require('../auth');
const { validateTest, isCalendarDate } = require('../validation');

const router = express.Router();
router.use(requireAuth);

router.get('/schedule', (req, res) => {
  if (!isCalendarDate(req.query.date)) {
    return res.status(400).json({ error: 'validation_failed', message: 'Select a valid date.' });
  }
  return res.json({ appointments: getStore().getDailySchedule(req.query.date) });
});

router.get('/clients/:id/tests', (req, res) => {
  const store = getStore();
  if (!store.getClient(req.params.id)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }
  return res.json({ tests: store.getTestsByClient(req.params.id) });
});

router.post('/tests', (req, res) => {
  const { ok, fields, value } = validateTest(req.body);
  if (!ok) return res.status(400).json({ error: 'validation_failed', message: 'Please check the test details.', fields });
  const store = getStore();
  if (!store.getClient(value.clientId)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }
  const test = store.addTest({ ...value, createdBy: req.user.displayName || req.user.username });
  return res.status(201).json({ test });
});

router.delete('/tests/:id', (req, res) => {
  const store = getStore();
  const test = store.getTest(req.params.id);
  if (!test) return res.status(404).json({ error: 'not_found', message: 'Test appointment not found.' });
  store.deleteTest(test.id);
  return res.json({ ok: true, clientId: test.clientId });
});

module.exports = router;