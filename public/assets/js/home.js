/* =====================================================================
   Home page — featured services, reviews, live availability teaser
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  const MARK = `<svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">` +
    `<path d="M192 14C178 66 132 82 94 114C62 141 56 178 76 212C70 184 82 152 114 130C144 109 178 86 192 14Z" fill="currentColor"/>` +
    `<path d="M192 14C212 68 194 128 142 156C112 172 90 190 88 228C82 204 88 176 116 154C152 126 184 88 192 14Z" fill="currentColor"/>` +
    `<path d="M126 24C86 42 74 86 112 118C148 148 178 176 144 226C136 236 120 242 104 242C132 234 152 214 148 186C144 160 116 142 94 120C64 90 76 42 126 24Z" fill="currentColor"/>` +
    `<path d="M132 28C96 46 88 86 122 116C156 146 172 178 142 222C160 188 148 152 114 122C82 94 92 48 132 28Z" fill="#DEAD55"/>` +
    `<path d="M84 188C74 206 76 228 92 244C96 248 102 246 100 240C88 226 84 208 84 188Z" fill="currentColor"/>` +
    `</svg>`;

  async function loadServices() {
    const mount = H.qs('#home-services');
    if (!mount) return;
    try {
      const { services } = await H.api.get('/api/services');
      // lead with photographed services so the trio stays visually even
      const featured = services.filter((s) => s.is_featured && s.image_url);
      const pool = featured.length >= 3 ? featured : services.filter((s) => s.image_url);
      const list = (pool.length >= 3 ? pool : services).slice(0, 3);
      mount.innerHTML = list.map((s, i) => `
        <article class="card card-interactive service-card has-photo reveal" style="--reveal-delay:${i * 70}ms">
          ${s.image_url ? `<div class="service-photo">
            <img src="${H.esc(s.image_url)}" alt="${H.esc(s.name)} at Lumina Salon" loading="lazy" decoding="async" width="860" height="642" />
            ${s.badge ? `<span class="chip chip-sm ${s.badge === 'Signature' ? 'chip-gold' : 'chip-primary'} service-photo-badge">${H.esc(s.badge)}</span>` : ''}
          </div>` : `<div class="service-photo service-photo--type" aria-hidden="true">
            <span class="sp-mark">${MARK}</span>
            <span class="sp-word">${H.esc(s.category)}</span>
            ${s.badge ? `<span class="chip chip-sm ${s.badge === 'Signature' ? 'chip-gold' : 'chip-primary'} service-photo-badge">${H.esc(s.badge)}</span>` : ''}
          </div>`}
          <div class="service-card-top">
            <h3>${H.esc(s.name)}</h3>
            <span class="chip chip-sm chip-outline">${H.esc(s.category)}</span>
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
      if (!list.length) {
        // No published reviews yet — drop the whole section rather than
        // showing an empty shell or invented testimonials.
        const section = mount.closest('section');
        if (section) section.hidden = true;
        return;
      }
      const section = mount.closest('section');
      if (section) section.hidden = false;
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
