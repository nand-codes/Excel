'use strict';

const express = require('express');

const { getStore } = require('../store');
const { requireAuth } = require('../auth');
const { validatePayment } = require('../validation');

const router = express.Router();

router.use(requireAuth);

router.get('/clients/:id/payments', (req, res) => {
  const store = getStore();
  if (!store.getClient(req.params.id)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }
  return res.json({
    payments: store.getPaymentsByClient(req.params.id),
    total: store.getPaymentTotal(req.params.id),
  });
});

router.get('/clients/:id/payments/total', (req, res) => {
  res.json({ total: getStore().getPaymentTotal(req.params.id) });
});

/** Records a payment and returns the new running total for the WhatsApp receipt. */
router.post('/payments', (req, res) => {
  const { ok, fields, value } = validatePayment(req.body?.payment ?? req.body);
  if (!ok) {
    return res.status(400).json({ error: 'validation_failed', message: 'Please check the payment details.', fields });
  }

  const store = getStore();
  if (!store.getClient(value.clientId)) {
    return res.status(404).json({ error: 'not_found', message: 'Client not found.' });
  }

  store.addPayment(value);

  return res.status(201).json({
    payment: store.getPayment(value.id),
    total: store.getPaymentTotal(value.clientId),
  });
});

router.delete('/payments/:id', (req, res) => {
  const store = getStore();
  const payment = store.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'not_found', message: 'Payment not found.' });

  store.deletePayment(req.params.id);

  return res.json({
    ok: true,
    clientId: payment.clientId,
    total: store.getPaymentTotal(payment.clientId),
  });
});

module.exports = router;
