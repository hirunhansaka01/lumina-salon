/**
 * A printable invoice for one appointment.
 *
 * Lives on its own page so what the printer sees is exactly the document:
 * no admin chrome, no sidebar, one page of A4.
 */
(() => {
  'use strict';

  const H = window.Hearth;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const token = sessionStorage.getItem('lumina.admin.token') || localStorage.getItem('lumina.admin.token');

  const root = () => document.getElementById('receipt-root');

  const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

  const when = (date, time) => {
    if (!date) return '';
    const d = new Date(`${date}T${time || '00:00'}:00`);
    return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + (time ? ` at ${H.time12(time)}` : '');
  };

  function fail(message) {
    root().innerHTML = `
      <div class="receipt-doc">
        <h1>Receipt unavailable</h1>
        <p class="body-md">${message}</p>
        <p class="body-sm dim">Open it again from Appointments in the studio admin.</p>
      </div>`;
  }

  function paint(r, showNotes) {
    const total = r.total_cents / 100;
    document.title = `Receipt ${r.number} — ${r.studio.name}`;
    root().innerHTML = `
      <div class="receipt-doc">
        <header class="receipt-head">
          <div>
            <p class="receipt-wordmark">${escapeHtml(r.studio.name)}</p>
            <p class="receipt-address">${escapeHtml(r.studio.address || '')}</p>
            <p class="receipt-address">${escapeHtml(r.studio.phone || '')}${r.studio.email ? ` · ${escapeHtml(r.studio.email)}` : ''}</p>
          </div>
          <div class="receipt-meta">
            <p class="receipt-label">${r.paid ? 'Receipt' : 'Invoice'}</p>
            <p class="receipt-number tabular">${escapeHtml(r.number)}</p>
            <p class="receipt-address">${new Date(r.issued_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </header>

        <hr class="receipt-rule" />

        <section class="receipt-parties">
          <div>
            <p class="receipt-label">Billed to</p>
            <p class="receipt-strong">${escapeHtml(r.client.name)}</p>
            ${r.client.email ? `<p class="receipt-address">${escapeHtml(r.client.email)}</p>` : ''}
            ${r.client.phone ? `<p class="receipt-address">${escapeHtml(r.client.phone)}</p>` : ''}
          </div>
          <div>
            <p class="receipt-label">Appointment</p>
            <p class="receipt-strong">${escapeHtml(when(r.appointment.date, r.appointment.time))}</p>
            ${r.stylist.name ? `<p class="receipt-address">with ${escapeHtml(r.stylist.name)}${r.stylist.title ? ` · ${escapeHtml(r.stylist.title)}` : ''}</p>` : ''}
          </div>
        </section>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Service</th>
              <th class="num">Qty</th>
              <th class="num">Time</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${r.items.map((i) => `
              <tr>
                <td>
                  <span class="receipt-strong">${escapeHtml(i.description)}</span>
                  ${i.detail ? `<span class="receipt-address" style="display:block">${escapeHtml(i.detail)}</span>` : ''}
                </td>
                <td class="num tabular">${i.qty}</td>
                <td class="num tabular">${H.duration(i.duration_minutes)}</td>
                <td class="num tabular">${money(i.total_cents)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <section class="receipt-totals">
          <div class="receipt-total-row"><span>Subtotal</span><span class="tabular">${money(r.subtotal_cents)}</span></div>
          ${r.discount_cents ? `<div class="receipt-total-row"><span>Discount</span><span class="tabular">−${money(r.discount_cents)}</span></div>` : ''}
          <div class="receipt-total-row receipt-grand"><span>Total</span><span class="tabular">$${total.toFixed(2)}</span></div>
          <div class="receipt-total-row"><span>Status</span><span>${r.paid ? 'Paid in studio' : 'Due at your appointment'}</span></div>
        </section>

        ${showNotes && r.appointment.notes ? `
        <section class="receipt-notes">
          <p class="receipt-label">Notes</p>
          <p class="receipt-address" style="white-space:pre-line">${escapeHtml(r.appointment.notes)}</p>
        </section>` : ''}

        <footer class="receipt-foot">
          <p class="receipt-thanks">Thank you for sitting in our chair.</p>
          <p class="receipt-address">Free changes or cancellation up to the studio's notice window — just call ${escapeHtml(r.studio.phone || 'us')}.</p>
          <p class="receipt-address">Booking reference ${escapeHtml(r.number)} · ${escapeHtml(r.appointment.booked_via === 'online' ? 'Booked online' : 'Booked in the studio')}</p>
        </footer>
      </div>`;
  }

  function escapeHtml(v = '') {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function load(showNotes) {
    if (!id) return fail('That link is missing its appointment.');
    try {
      const res = await fetch(`/api/admin/appointments/${id}/receipt`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load that appointment.');
      paint(data.receipt, showNotes);
    } catch (err) {
      fail(escapeHtml(err.message));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load(false);
    document.getElementById('receipt-show-notes').addEventListener('change', (e) => load(e.target.checked));
    document.getElementById('receipt-print').addEventListener('click', () => window.print());
  });
})();
