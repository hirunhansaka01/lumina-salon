'use strict';

/**
 * Transactional email templates.
 *
 * Email clients are a museum of 1999: tables for layout, inline styles only,
 * no flexbox, no external CSS. These are built to look right in Gmail, Apple
 * Mail, Outlook and mobile, and to degrade to a clean text version.
 */

const C = {
  bg: '#FAF4EB',
  surface: '#FFFDF9',
  ink: '#172726',
  ink2: '#5E5A53',
  line: '#E4DDD2',
  primary: '#005552',
  primarySoft: '#EAF4F2',
  gold: '#DEAD55',
  onPrimary: '#FFFCF6',
};

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── shared pieces ─────────────────────────────────────────────────── */

function shell({ preheader = '', title = '', body = '', footerNote = '', studio = {}, reason = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;font-size:1px;color:${C.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- wordmark -->
        <tr>
          <td align="center" style="padding:6px 0 22px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;letter-spacing:0.02em;color:${C.ink};">
              Lumina
            </div>
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:${C.ink2};padding-top:5px;">
              Hair&nbsp;Studio
            </div>
            <div style="width:34px;height:2px;background:${C.gold};margin:14px auto 0;border-radius:2px;"></div>
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td style="background:${C.surface};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
            ${body}
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="padding:26px 26px 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${C.ink2};">
            ${footerNote ? `<p style="margin:0 0 14px;">${footerNote}</p>` : ''}
            <p style="margin:0 0 6px;color:${C.ink};font-weight:bold;">${esc(studio.name || 'Lumina Salon')}</p>
            <p style="margin:0;">${esc(studio.address || '')}</p>
            <p style="margin:6px 0 0;">
              <a href="tel:${esc((studio.phone || '').replace(/[^0-9+]/g, ''))}" style="color:${C.primary};text-decoration:none;">${esc(studio.phone || '')}</a>
              <span style="color:${C.line};">&nbsp;·&nbsp;</span>
              <a href="mailto:${esc(studio.email || '')}" style="color:${C.primary};text-decoration:none;">${esc(studio.email || '')}</a>
            </p>
            <p style="margin:18px 0 0;font-size:11px;color:#9A948B;">
              ${reason ? esc(reason) : 'You are receiving this because you booked an appointment with us.'}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function header(headline, intro) {
  return `
  <tr>
    <td style="background:${C.primary};padding:38px 34px 34px;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${C.gold};padding-bottom:12px;">
        Lumina Salon
      </div>
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:29px;line-height:1.22;color:${C.onPrimary};letter-spacing:-0.01em;">
        ${esc(headline)}
      </h1>
      ${intro ? `<p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,252,246,0.82);">${intro}</p>` : ''}
    </td>
  </tr>`;
}

function details(rows) {
  const cells = rows
    .filter((r) => r && r.value)
    .map((r, i) => `
      <tr>
        <td style="padding:${i === 0 ? '0' : '13px'} 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8E8880;width:38%;vertical-align:top;">
          ${esc(r.label)}
        </td>
        <td style="padding:${i === 0 ? '0' : '13px'} 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;color:${C.ink};font-weight:bold;vertical-align:top;">
          ${esc(r.value)}
        </td>
      </tr>`).join('');
  return `
  <tr>
    <td style="padding:30px 34px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${C.primarySoft};border-radius:14px;">
        <tr><td style="padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function button(label, href, { primary = true } = {}) {
  const bg = primary ? C.primary : 'transparent';
  const color = primary ? C.onPrimary : C.primary;
  const border = primary ? C.primary : C.line;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" style="border-radius:999px;background:${bg};border:1px solid ${border};">
        <a href="${esc(href)}"
           style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.01em;color:${color};text-decoration:none;border-radius:999px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

function footnote(text) {
  return `
  <tr>
    <td style="padding:22px 34px 34px;">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:${C.ink2};">
        ${text}
      </p>
    </td>
  </tr>`;
}

function paragraph(text) {
  return `
  <tr>
    <td style="padding:26px 34px 0;">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${C.ink2};">${text}</p>
    </td>
  </tr>`;
}

/* ── templates ─────────────────────────────────────────────────────── */

const TEMPLATES = {
  /** Sent the moment someone books online (pending or confirmed). */
  'booking-received'(d) {
    const body = [
      header(d.headline, d.intro),
      d.status === 'confirmed' ? '' : `
      <tr>
        <td style="padding:24px 34px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#FBF3E2;border:1px solid #F0E2C4;border-radius:12px;">
            <tr><td style="padding:16px 18px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#7A5B14;">
              <strong style="color:#5C440E;">Awaiting confirmation.</strong>
              Your slot is held for you. We'll email again as soon as the studio confirms it.
            </td></tr>
          </table>
        </td>
      </tr>`,
      details([
        { label: 'Service', value: d.service },
        { label: 'Stylist', value: d.stylist },
        { label: 'When', value: d.when },
        { label: 'Duration', value: d.duration },
        { label: 'Price', value: `${d.price} · pay in the studio` },
        { label: 'Reference', value: d.reference },
      ]),
      paragraph(`<strong style="color:${C.ink};">Where to find us.</strong><br />${esc(d.address)}<br />
        Free changes or cancellation up to ${esc(d.cancellationHours)} hours before.`),
      `<tr><td align="center" style="padding:28px 34px 6px;">${button('Book another appointment', d.bookingUrl)}</td></tr>`,
      footnote(`Need to change something? Call <a href="tel:${esc((d.phone || '').replace(/[^0-9+]/g, ''))}" style="color:${C.primary};">${esc(d.phone)}</a>
        or reply to this email — a person reads it.`),
    ].join('');
    return shell({ preheader: d.preheader, title: d.headline, body, studio: d, footerNote: 'Warm editorial hair care and bespoke colour.' });
  },

  /** Confirmation, reschedule or cancellation by the studio. */
  'booking-status'(d) {
    const tone = d.status === 'cancelled'
      ? 'background:#FBEDEC;border:1px solid #F0D6D4;color:#8E3E3B;'
      : 'background:' + C.primarySoft + ';border:1px solid #CFE6E2;color:' + C.primary + ';';
    const body = [
      header(d.headline, d.intro),
      `<tr><td style="padding:24px 34px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${tone}border-radius:12px;">
          <tr><td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;">
            <strong style="text-transform:uppercase;letter-spacing:0.1em;font-size:11px;">${esc(d.status)}</strong>
            <span style="opacity:0.75;"> · reference ${esc(d.reference)}</span>
          </td></tr>
        </table>
      </td></tr>`,
      details([
        { label: 'Service', value: d.service },
        { label: 'Stylist', value: d.stylist },
        { label: 'When', value: d.when },
        { label: 'Duration', value: d.duration },
        { label: 'Price', value: d.price },
      ]),
      d.status === 'cancelled' ? '' : `<tr><td align="center" style="padding:28px 34px 6px;">${button('Change or cancel online', d.bookingUrl, { primary: false })}</td></tr>`,
      footnote(`Questions? <a href="tel:${esc((d.phone || '').replace(/[^0-9+]/g, ''))}" style="color:${C.primary};">${esc(d.phone)}</a> · ${esc(d.address)}`),
    ].join('');
    return shell({ preheader: d.preheader, title: d.headline, body, studio: d });
  },

  /**
   * A person at the studio answering an enquiry. Warm, plain, signed —
   * it should read like a letter, not a notification.
   */
  'studio-reply'(d) {
    const body = [
      `<tr>
        <td style="padding:34px 34px 0;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${C.gold};">
            ${esc(d.name || 'Lumina Salon')}
          </p>
          <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.25;color:${C.ink};">
            ${esc(d.headline || 'Your message to us')}
          </h1>
        </td>
      </tr>`,
      `<tr><td style="padding:22px 34px 0;">
        <div style="height:1px;background:${C.line};"></div>
      </td></tr>`,
      `<tr><td style="padding:22px 34px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:${C.ink};">${d.bodyHtml}</div>
      </td></tr>`,
      d.signature ? `<tr><td style="padding:26px 34px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:${C.ink2};">${d.signature}</div>
      </td></tr>` : '',
      d.original ? `<tr><td style="padding:30px 34px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${C.bg};border-left:3px solid ${C.gold};border-radius:6px;">
          <tr><td style="padding:16px 18px;">
            <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#9A948B;">
              Your original message
            </p>
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:${C.ink2};white-space:pre-line;">${esc(d.original)}</p>
          </td></tr>
        </table>
      </td></tr>` : '',
      `<tr><td align="center" style="padding:28px 34px 34px;">
        ${button(d.buttonLabel || 'Book a chair', d.buttonUrl || '')}
      </td></tr>`,
    ].join('');
    return shell({
      preheader: d.preheader || '',
      title: d.headline || 'Your message to us',
      body,
      studio: d,
      reason: 'You are receiving this because you wrote to us through our website.',
    });
  },

  /** Internal: something happened in the diary. */
  'studio-alert'(d) {
    const body = [
      header(d.headline, d.intro),
      details(d.rows || []),
      d.notes ? paragraph(`<strong style="color:${C.ink};">Client note</strong><br />${esc(d.notes)}`) : '',
      `<tr><td align="center" style="padding:28px 34px 6px;">${button(d.actionLabel || 'Open the studio admin', d.actionUrl || '')}</td></tr>`,
      footnote(`Sent to the studio inbox at ${esc(d.email || '')}.`),
    ].join('');
    return shell({ preheader: d.preheader, title: d.headline, body, studio: d });
  },

  /** Broadcast: a seasonal note / announcement to clients. */
  announcement(d) {
    const body = [
      header(d.headline, d.intro),
      d.body ? paragraph(d.body) : '',
      d.highlights && d.highlights.length ? `
      <tr><td style="padding:22px 34px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:${C.primarySoft};border-radius:14px;"><tr><td style="padding:20px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${d.highlights.map((h) => `
          <tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${C.ink};">
            <span style="color:${C.gold};padding-right:8px;">&#9679;</span>${esc(h)}
          </td></tr>`).join('')}</table>
      </td></tr></table></td></tr>` : '',
      `<tr><td align="center" style="padding:28px 34px 6px;">${button(d.buttonLabel || 'Book a chair', d.buttonUrl || '')}</td></tr>`,
      footnote(d.footnote || `Warmly, the ${esc(d.name || 'Lumina Salon')} team · ${esc(d.address || '')}`),
      d.unsubscribeUrl ? `<tr><td style="padding:10px 34px 26px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#9A948B;">
        You are on the studio letters list because you asked for the occasional note from us.
        <a href="${esc(d.unsubscribeUrl)}" style="color:${C.ink2};text-decoration:underline;">Unsubscribe in one click</a>.
      </td></tr>` : '',
    ].join('');
    return shell({
      preheader: d.preheader,
      title: d.headline,
      body,
      studio: d,
      footerNote: d.signoff || '',
      reason: 'You are receiving this because you joined the studio letters list.',
    });
  },
};

function renderEmail(template, data) {
  const fn = TEMPLATES[template];
  if (!fn) throw new Error(`Unknown email template: ${template}`);
  return fn(data);
}

module.exports = { renderEmail, TEMPLATES, esc };
