'use strict';

/**
 * Shapes database rows into the flat objects the email templates expect.
 * Kept separate so the routes stay readable.
 */

const { formatTime12 } = require('./time');

function studioBasics(settings = {}) {
  const name = process.env.SALON_NAME || 'Lumina Salon';
  const url = process.env.PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || 'http://localhost:3000';
  return {
    name,
    url: url.replace(/\/$/, ''),
    address: settings.studio_address || '742 Evergreen Terrace, Springfield',
    phone: settings.studio_phone || '(555) 019-8234',
    email: settings.studio_email || 'hello@luminasalon.com',
    cancellationHours: settings.cancellation_hours ?? 24,
  };
}

/** settings may be a settings object or a promise-free value already resolved. */
async function studioContext(settings) {
  return studioBasics(settings || {});
}

function durationText(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || 'there';
}

/** YYYY-MM-DD in the studio's timezone-ish (dates are stored as plain dates). */
function prettyWhen(date, time12) {
  if (!date) return time12 || '';
  const stamp = new Date(`${date}T12:00:00`);
  const day = Number.isNaN(stamp.getTime())
    ? date
    : stamp.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return time12 ? `${day} at ${time12}` : day;
}

const fullName = (person = {}) =>
  person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Guest';

/**
 * appointment/client/service/stylist come straight from Supabase rows.
 *
 * Returns both the raw rows (`client`, `appointment`, `service`, `stylist`) and
 * the flat fields the email templates read — the templates are intentionally
 * dumb, so every value they print is prepared here.
 */
function appointmentContext({ appointment, client, service, stylist }) {
  const date = appointment.appointment_date || appointment.date;
  const time = appointment.time;
  const time12 = formatTime12(time);
  const priceCents = appointment.price_cents ?? service.price_cents;
  const notes = appointment.notes || '';
  const name = fullName(client);

  const appt = {
    reference: appointment.reference,
    status: appointment.status,
    date,
    time,
    time12,
    when: prettyWhen(date, time12),
    durationText: durationText(appointment.duration_minutes || service.duration_minutes),
    price_cents: priceCents,
    price: `$${Math.round(Number(priceCents || 0) / 100)}`,
    notes,
  };

  const clientRow = { ...client, name, firstName: firstName(name) };
  const serviceRow = { id: service.id, name: service.name };
  const stylistRow = { id: stylist.id, name: stylist.name };

  return {
    client: clientRow,
    appointment: appt,
    service: serviceRow,
    stylist: stylistRow,
    /* flat convenience fields */
    when: appt.when,
    durationText: appt.durationText,
    price: appt.price,
    price_cents: priceCents,
    reference: appt.reference,
    status: appt.status,
    notes,
    serviceName: serviceRow.name,
    stylistName: stylistRow.name,
    clientName: name,
    clientFirstName: clientRow.firstName,
  };
}

module.exports = { studioBasics, studioContext, appointmentContext, durationText, firstName, fullName, prettyWhen };
