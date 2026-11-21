'use strict';

/** Tiny helpers shared by the API routes. */

class ApiError extends Error {
  constructor(status, message, code = undefined, extra = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra || {});
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function clean(v, max = 500) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normEmail(v) { return clean(v, 160).toLowerCase(); }

function normPhone(v) { return clean(v, 32).replace(/[^\d+()\-\s]/g, ''); }

function requireFields(body, fields) {
  const missing = fields.filter((f) => !clean(body[f]));
  if (missing.length) throw new ApiError(400, `Please fill in: ${missing.join(', ')}`, 'VALIDATION');
}

function apiOk(res, data, status = 200) { return res.status(status).json({ ok: true, ...data }); }

module.exports = { ApiError, wrap, clean, normEmail, normPhone, requireFields, EMAIL_RE, apiOk };
