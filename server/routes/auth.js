'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const { getStore } = require('../store');
const { verifyPassword, startSession, endSession } = require('../auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: config.loginWindowMinutes * 60 * 1000,
  limit: config.loginAttemptsPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts', message: 'Too many sign-in attempts. Try again later.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'missing_credentials', message: 'Enter your username and password.' });
  }

  const store = getStore();
  const user = store.getUserByUsername(username);

  // Compare against a dummy hash when the user is unknown so timing does not
  // reveal which usernames exist.
  const hash = user ? user.passwordHash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordOk = await verifyPassword(password, hash);

  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Incorrect username or password.' });
  }

  startSession(res, user.id);
  store.touchUserLogin(user.id);

  return res.json({
    user: { id: user.id, username: user.username, displayName: user.displayName || user.username, role: user.role },
  });
});

router.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth_required', message: 'Please sign in.' });
  }
  return res.json({ user: req.user });
});

module.exports = router;
