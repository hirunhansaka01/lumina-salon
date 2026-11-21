'use strict';

/**
 * Lumina Salon — Node/Express application.
 *
 * Locally:  node server/index.js  → serves /public statics + /api
 * On Vercel: api/index.js exports this same app for every /api/* request,
 *            and /public is served as static files by the platform.
 */

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* image uploads arrive as base64 data URLs, so the JSON body needs headroom */
const JSON_LIMIT = process.env.API_JSON_LIMIT || '6mb';
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

/* ── Security headers (kept CSP-free so the preview and dev tools work) ── */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* ── API ── */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lumina-salon',
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

/* ── Static site (local dev + any non-Vercel host) ── */
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.get('/admin', (_req, res) => res.sendFile(path.join(pub, 'admin.html')));

/* SPA-ish fallbacks so /booking, /services, /contact all resolve locally */
const pages = ['index', 'services', 'booking', 'contact', 'admin'];
app.get('/:page', (req, res, next) => {
  const page = String(req.params.page).replace(/\.html$/, '');
  if (pages.includes(page)) return res.sendFile(path.join(pub, `${page}.html`));
  next();
});

/* ── 404 + error handling ── */
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ ok: false, error: 'Not found.' });
  res.status(404).sendFile(path.join(pub, '404.html'), (err) => {
    if (err) res.status(404).type('text').send('Not found');
  });
});

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);
  const payload = {
    ok: false,
    error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    code: err.code || undefined,
  };
  if (err.details) payload.details = err.details;
  res.status(status).json(payload);
});

module.exports = app;
