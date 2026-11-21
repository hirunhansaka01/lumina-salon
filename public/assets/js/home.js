/* =====================================================================
   Home page — featured services, reviews, live availability teaser
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  async function loadServices() {
    const mount = H.qs('#home-services');
    if (!mount) return;
    try {
      const { services } = await H.api.get('/api/services');
      const featured = services.filter((s) => s.is_featured).slice(0, 3);
      const list = (featured.length ? featured : services.slice(0, 3));
      mount.innerHTML = list.map((s, i) => `
        <article class="card card-interactive service-card reveal" style="--reveal-delay:${i * 70}ms">
          <div class="service-card-top">
            <h3>${H.esc(s.name)}</h3>
            ${s.badge ? `<span class="chip chip-sm ${s.badge === 'Signature' ? 'chip-gold' : 'chip-primary'}">${H.esc(s.badge)}</span>` : ''}
          </div>
          <p class="clamp-2">${H.esc(s.description || '')}</p>
          <div class="service-meta">
            <span class="item">${H.icon('clock')}${H.duration(s.duration_minutes)}</span>
            <span class="item">${H.icon('star')}4.9</span>
            <span class="item">${H.esc(s.category)}</span>
          </div>
          <div class="service-foot">
            <span class="service-price">${H.money(s.price_cents, { cents: false })}</span>
            <a class="btn btn-sm btn-outline" href="/booking?service=${encodeURIComponent(s.slug)}">Book service</a>
          </div>
        </article>`).join('');
      H.reveal(mount);
    } catch (err) {
      mount.innerHTML = `<div class="empty" style="grid-column:1/-1">${H.icon('alert')}<p class="body-md">The menu is having a moment. <a class="underline-quiet" href="/services">Try the services page</a>.</p></div>`;
    }
  }

  async function loadReviews() {
    const mount = H.qs('#home-reviews');
    if (!mount) return;
    try {
      const { reviews } = await H.api.get('/api/reviews');
      const list = reviews.slice(0, 3);
      mount.innerHTML = list.map((r, i) => `
        <article class="card feature-card review-card reveal" style="--reveal-delay:${i * 70}ms">
          ${H.stars(r.rating)}
          <p class="review-quote">${H.esc(r.quote)}</p>
          <div class="review-author">
            <span class="avatar ${i % 2 ? 'avatar-gold' : ''}" aria-hidden="true">${H.initials(r.client_name)}</span>
            <div>
              <div class="title-sm">${H.esc(r.client_name)}</div>
              <div class="body-sm dim">${H.esc(r.location || 'Springfield')}</div>
            </div>
          </div>
        </article>`).join('');
      H.reveal(mount);
    } catch { mount.innerHTML = ''; }
  }

  async function loadNextSlot() {
    const node = H.qs('[data-next-slot]');
    if (!node) return;
    try {
      const today = new Date();
      const iso = today.toLocaleDateString('en-CA');
      const { stylists } = await H.api.get('/api/stylists');
      if (!stylists.length) return;
      const { slots } = await H.api.get(`/api/availability?stylist_id=${stylists[0].id}&date=${iso}&service_id=`);
      const open = (slots || []).find((s) => s.available);
      node.textContent = open ? `Today · ${H.time12(open.time)}` : 'Tomorrow · 9:00 AM';
    } catch { /* keep the static fallback */ }
  }

  async function loadStudio() {
    try {
      const { studio } = await H.api.get('/api/studio');
      const bar = H.qs('[data-announcement]');
      if (studio.announcement && bar) {
        H.qs('[data-announcement-text]', bar).textContent = studio.announcement;
        bar.hidden = false;
      }
    } catch { /* silent */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStudio(); loadServices(); loadReviews(); loadNextSlot();
  });
})();
