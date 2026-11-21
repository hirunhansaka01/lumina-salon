'use strict';

/** Time helpers. Everything is stored as local salon time ('HH:MM' + 'YYYY-MM-DD'). */

const SALON_TZ = process.env.SALON_TIMEZONE || 'America/Chicago';

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function fromMinutes(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatTime12(hhmm) {
  const mins = toMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** 'YYYY-MM-DD' in the salon timezone for a JS Date (defaults to now). */
function salonDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 'HH:MM' in the salon timezone. */
function salonTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SALON_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('hour')}:${get('minute')}`;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-based weekday index (0 = Monday … 6 = Sunday). */
function weekdayIndex(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

function prettyDate(isoDate, opts = {}) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', ...opts,
  }).format(d);
}

function isValidISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function isValidTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }

module.exports = {
  SALON_TZ, toMinutes, fromMinutes, formatTime12, formatDuration,
  salonDate, salonTime, addDays, weekdayIndex, prettyDate, isValidISODate, isValidTime,
};
