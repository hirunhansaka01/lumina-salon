'use strict';

/**
 * Outbound email — SMTP through Gmail (or any provider).
 *
 * Credentials come only from environment variables, never from the repo:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME
 *
 * Nothing here throws into a request path: a booking must still succeed if
 * Gmail is unreachable. Every send is logged and its outcome returned.
 */

const nodemailer = require('nodemailer');
const { renderEmail } = require('./emails');

let transporter = null;
let verified = null;

const ENV = (key, fallback = '') => {
  const v = process.env[key];
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim();
};

function config() {
  const host = ENV('SMTP_HOST', 'smtp.gmail.com');
  const port = Number(ENV('SMTP_PORT', '587'));
  return {
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS
    secure: ENV('SMTP_SECURE') ? ENV('SMTP_SECURE') === 'true' : port === 465,
    user: ENV('SMTP_USER'),
    pass: ENV('SMTP_PASS'),
    fromEmail: ENV('MAIL_FROM', ENV('SMTP_USER')),
    fromName: ENV('MAIL_FROM_NAME', process.env.SALON_NAME || 'Lumina Salon'),
    notify: ENV('NOTIFY_EMAIL', ENV('SMTP_USER')),
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.host && c.user && c.pass);
}

function getTransport() {
  if (transporter) return transporter;
  const c = config();
  transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 12_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/** Confirm the credentials actually work (used by the admin test button). */
async function verify() {
  if (!isConfigured()) return { ok: false, error: 'SMTP is not configured.' };
  try {
    await getTransport().verify();
    verified = true;
    return { ok: true, host: config().host, port: config().port, user: config().user };
  } catch (err) {
    verified = false;
    return { ok: false, error: err.message };
  }
}

/**
 * Send one email.
 * @param {object} opts { to, subject, template, data, replyTo, text }
 * @returns {Promise<{ok:boolean, id?:string, error?:string, skipped?:boolean}>}
 */
async function send({ to, subject, template, data = {}, replyTo, text, headers = {} }) {
  if (!to) return { ok: false, error: 'No recipient.' };
  if (!isConfigured()) {
    console.warn('[mail] skipped — SMTP not configured');
    return { ok: false, skipped: true, error: 'SMTP not configured.' };
  }
  const c = config();
  const html = template ? renderEmail(template, data) : undefined;
  if (!html && !text) return { ok: false, error: 'Nothing to send.' };

  try {
    const cleanSubject = String(subject || 'Lumina Salon')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\u2014\u2013]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 180);

    const info = await getTransport().sendMail({
      from: `"${c.fromName}" <${c.fromEmail}>`,
      to,
      subject: cleanSubject,
      replyTo: replyTo || c.fromEmail,
      html,
      text: text || stripHtml(html),
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...headers,
      },
    });
    console.log('[mail] sent', template || 'text', '→', to, info.messageId);
    return { ok: true, id: info.messageId };
  } catch (err) {
    console.error('[mail] failed', template || 'text', '→', to, err.message);
    return { ok: false, error: err.message };
  }
}

function stripHtml(html = '') {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─────────────────────────── Appointments ─────────────────────────── */

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(0)}`;
const prettyDate = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
};

/** The client just booked (pending or confirmed). */
async function sendBookingReceived({ client, appointment, service, stylist, studio }) {
  const when = `${prettyDate(appointment.date)} at ${appointment.time12}`;
  const confirmed = appointment.status === 'confirmed';
  return send({
    to: client.email,
    subject: confirmed
      ? `Your chair is booked — ${when}`
      : `We have your request — ${when}`,
    template: 'booking-received',
    replyTo: studio.email,
    data: {
      preheader: confirmed ? `See you ${when}.` : `We'll confirm ${when} shortly.`,
      headline: confirmed ? 'Your chair is booked' : 'Your request is with us',
      intro: confirmed
        ? `Lovely — you're in the book. Here is everything you need for your visit to ${studio.name}.`
        : `Thank you, ${client.firstName}. We've reserved your preferred time and will confirm by email shortly (usually within a few hours).`,
      clientName: client.name,
      reference: appointment.reference,
      status: appointment.status,
      service: service.name,
      stylist: stylist.name,
      when,
      duration: appointment.durationText,
      price: money(appointment.price_cents),
      durationText: appointment.durationText,
      address: studio.address,
      phone: studio.phone,
      email: studio.email,
      cancelUrl: `${studio.url}/booking?reference=${appointment.reference}`,
      bookingUrl: `${studio.url}/booking`,
      cancellationHours: studio.cancellationHours,
    },
  });
}

/** The studio confirmed / rescheduled / cancelled an appointment. */
async function sendBookingStatus({ client, appointment, service, stylist, studio, kind }) {
  const when = `${prettyDate(appointment.date)} at ${appointment.time12}`;
  const map = {
    confirmed: {
      subject: `Confirmed — ${when}`,
      headline: 'Your appointment is confirmed',
      intro: `We've confirmed your appointment, ${client.firstName}. See you at the studio.`,
    },
    cancelled: {
      subject: `Cancelled — ${when}`,
      headline: 'Your appointment has been cancelled',
      intro: `Your appointment has been released back to the diary. If this was a surprise, reply to this email or call us and we'll find you a new time.`,
    },
    rescheduled: {
      subject: `New time — ${when}`,
      headline: 'Your appointment has moved',
      intro: `Your appointment has a new time. Here are the updated details.`,
    },
  }[kind] || {
    subject: `Update to your appointment — ${when}`,
    headline: 'An update to your appointment',
    intro: `Here are the latest details for your visit.`,
  };

  return send({
    to: client.email,
    subject: map.subject,
    template: 'booking-status',
    replyTo: studio.email,
    data: {
      preheader: `${map.headline} · ${when}`,
      headline: map.headline,
      intro: map.intro,
      clientName: client.name,
      reference: appointment.reference,
      status: kind,
      service: service.name,
      stylist: stylist.name,
      when,
      duration: appointment.durationText,
      price: money(appointment.price_cents),
      durationText: appointment.durationText,
      address: studio.address,
      phone: studio.phone,
      email: studio.email,
      bookingUrl: `${studio.url}/booking`,
      cancellationHours: studio.cancellationHours,
    },
  });
}

/** Internal notification to the studio when something lands. */
/** NOTIFY_EMAIL wins over the (editable) settings row so a typo cannot mute alerts. */
const studioInbox = (fallback) => config().notify || fallback || '';

async function sendStudioAlert({ to, subject, template, data }) {
  const inbox = studioInbox(to);
  if (!inbox) return { ok: false, skipped: true };
  to = inbox;
  return send({ to, subject, template, data, replyTo: config().fromEmail });
}

module.exports = {
  config,
  isConfigured,
  verify,
  send,
  sendBookingReceived,
  sendBookingStatus,
  sendStudioAlert,
  prettyDate,
  money,
  stripHtml,
};
