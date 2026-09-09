'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const config = require('./config');
const { getStore } = require('./store');

const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), String(hash));
}

/** Sessions are looked up by hash so the raw cookie value is never stored. */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  };
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000).toISOString();

  getStore().createSession({ tokenHash: hashToken(token), userId, expiresAt });
  res.cookie(config.cookieName, token, cookieOptions());
}

function endSession(req, res) {
  const token = req.cookies ? req.cookies[config.cookieName] : null;
  if (token) getStore().deleteSession(hashToken(token));
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
}

/**
 * Attaches `req.user` when the request carries a valid session cookie.
 * Expired sessions are deleted as they are encountered.
 */
function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies ? req.cookies[config.cookieName] : null;
  if (!token) return next();

  const session = getStore().getSession(hashToken(token));
  if (!session) return next();

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    getStore().deleteSession(session.tokenHash);
    return next();
  }

  req.user = publicUser(session);
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'auth_required', message: 'Please sign in.' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'auth_required', message: 'Please sign in.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'This action needs an admin account.' });
  }
  return next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashToken,
  publicUser,
  startSession,
  endSession,
  loadUser,
  requireAuth,
  requireAdmin,
};
