'use strict';

const fs = require('fs');
const path = require('path');

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { loadUser } = require('./auth');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const paymentRoutes = require('./routes/payments');

function createApp() {
  const app = express();

  // Behind Caddy the client IP arrives in X-Forwarded-For; rate limiting needs it.
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Inline styles cover React style props and the generated print documents.
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'same-origin' },
    })
  );

  // Only needed when the UI runs on a different origin (not the case behind Caddy).
  if (config.corsOrigin) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.corsOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      return next();
    });
  }

  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests. Please slow down.' },
  });
  app.use('/api', apiLimiter);

  // Restores are the only large payload; everything else stays small on purpose.
  app.use('/api/clients/bulk', express.json({ limit: '25mb' }));
  app.use('/api', express.json({ limit: '1mb' }));

  app.use('/api', loadUser);
  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api', paymentRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown endpoint.' });
  });

  // ── Static React build ─────────────────────────────────────────
  // The bundle itself carries no client data; every record requires a session,
  // so serving the shell publicly is what lets the login screen load at all.
  const indexHtml = path.join(config.webDist, 'index.html');
  const hasBuild = fs.existsSync(indexHtml);

  if (hasBuild) {
    app.use(
      express.static(config.webDist, {
        index: false,
        setHeaders(res, filePath) {
          // Vite emits content-hashed asset names, so they can be cached hard.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
  }

  // SPA fallback without a wildcard route pattern (Express 5 path syntax).
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();

    if (!hasBuild) {
      return res
        .status(503)
        .type('text/plain')
        .send(
          'The web app has not been built yet.\n\n' +
            'Run "npm run web:build" (or "npm run web:dev" for the dev server).\n'
        );
    }

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexHtml);
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[api]', err);

    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'payload_too_large', message: 'That file is too large.' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'invalid_json', message: 'Malformed request body.' });
    }

    return res.status(status).json({
      error: status >= 500 ? 'server_error' : 'request_failed',
      message: status >= 500 ? 'Something went wrong on the server.' : err.message || 'Request failed.',
    });
  });

  return app;
}

module.exports = { createApp };
