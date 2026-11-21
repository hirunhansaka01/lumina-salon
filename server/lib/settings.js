'use strict';

/**
 * Settings are stored in a key/value table so the studio can change policy
 * (hours, lead time, slot grid) from the admin without a deploy.
 * These are the fallbacks used before the row exists.
 */
const DEFAULTS = {
  slot_interval_minutes: 30,
  lead_time_minutes: 120,
  max_advance_days: 90,
  booking_auto_confirm: false,
  cancellation_hours: 24,
  studio_address: '742 Evergreen Terrace, Springfield',
  studio_phone: '(555) 019-8234',
  studio_email: 'hello@luminasalon.com',
  notify_email: 'studio@luminasalon.com',
  announcement: '',
};

const NUMERIC = new Set(['slot_interval_minutes', 'lead_time_minutes', 'max_advance_days', 'cancellation_hours']);
const BOOLEAN = new Set(['booking_auto_confirm']);

let cache = null;
let cachedAt = 0;
const TTL = 15_000;

async function getSettings(force = false) {
  const db = require('../db');
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  try {
    const { data } = await db.from('settings').select('key,value');
    const merged = { ...DEFAULTS };
    for (const row of data || []) {
      if (NUMERIC.has(row.key)) merged[row.key] = Number(row.value);
      else if (BOOLEAN.has(row.key)) merged[row.key] = row.value === 'true';
      else merged[row.key] = row.value;
    }
    cache = merged;
    cachedAt = Date.now();
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function invalidate() { cache = null; cachedAt = 0; }

module.exports = { getSettings, invalidate, DEFAULTS, NUMERIC, BOOLEAN };
