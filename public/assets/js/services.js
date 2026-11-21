/* =====================================================================
   Services page — search, category filter, sort, layout toggle
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  const state = { services: [], categories: [], query: '', category: 'all', sort: 'featured', view: 'grid' };
  const grid = () => H.qs('#service-grid');

  function priceLabel(cents) { return H.money(cents, { cents: false }); }

  function card(s, i) {
    const badgeClass = ['Signature', 'Package'].includes(s.badge) ? 'chip-gold' : 'chip-primary';
    return `
      <article class="card card-interactive service-card" style="--reveal-delay:${Math.min(i * 45, 260)}ms">
        <div class="service-card-top">
          <h3>${H.esc(s.name)}</h3>
          ${s.badge ? `<span class="chip chip-sm ${badgeClass}">${H.esc(s.badge)}</span>` : `<span class="chip chip-sm chip-outline">${H.esc(s.category)}</span>`}
        </div>
        <div class="service-info">
          <p class="clamp-2">${H.esc(s.description || '')}</p>
          <div class="service-meta">
            <span class="item">${H.icon('clock')}${H.duration(s.duration_minutes)}</span>
            <span class="item">${H.icon('star')}${s.is_featured ? '4.9' : '4.8'}</span>
            <span class="item">${H.esc(s.category)}</span>
          </div>
        </div>
        <div class="service-foot">
          <span class="service-price">${priceLabel(s.price_cents)}</span>
          <a class="btn btn-sm" href="/booking?service=${encodeURIComponent(s.slug)}">Book service</a>
        </div>
      </article>`;
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = state.services.filter((s) => {
      const inCategory = state.category === 'all' || s.category === state.category;
      const haystack = `${s.name} ${s.description || ''} ${s.category}`.toLowerCase();
      return inCategory && (!q || haystack.includes(q));
    });
    const sorters = {
      featured: (a, b) => (b.is_featured - a.is_featured) || a.price_cents - b.price_cents,
      'price-asc': (a, b) => a.price_cents - b.price_cents,
      'price-desc': (a, b) => b.price_cents - a.price_cents,
      duration: (a, b) => a.duration_minutes - b.duration_minutes,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[state.sort] || sorters.featured);
  }

  function renderCategories() {
    const bar = H.qs('#category-bar');
    if (!bar) return;
    const counts = state.services.reduce((acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc; }, {});
    const chips = [{ key: 'all', label: 'All services', count: state.services.length }]
      .concat(state.categories.map((c) => ({ key: c, label: c, count: counts[c] || 0 })));
    bar.innerHTML = chips.map((c) => `
      <button class="filter-chip ${state.category === c.key ? 'is-active' : ''}" data-category="${H.esc(c.key)}" aria-pressed="${state.category === c.key}">
        ${H.esc(c.label)} <span class="count">${c.count}</span>
      </button>`).join('');
    H.qsa('[data-category]', bar).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.category;
        renderCategories();
        render();
      });
    });
  }

  function render() {
    const list = filtered();
    const mount = grid();
    const empty = H.qs('#service-empty');
    const count = H.qs('#results-count');
    const wrap = H.qs('#service-grid');

    if (count) {
      count.innerHTML = `<strong>${list.length}</strong> of ${state.services.length} services${state.category !== 'all' ? ` in ${H.esc(state.category)}` : ''}${state.query ? ` for “${H.esc(state.query)}”` : ''}`;
    }
    if (!list.length) {
      mount.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    wrap.className = `grid ${state.view === 'grid' ? 'grid-3' : 'grid-2 service-list'}`;
    mount.innerHTML = list.map(card).join('');
    H.hydrate(mount);
    requestAnimationFrame(() => H.qsa('.service-card', mount).forEach((el, i) => {
      el.classList.add('reveal');
      setTimeout(() => el.classList.add('is-in'), i * 35);
    }));
  }

  async function load() {
    try {
      const { services, categories } = await H.api.get('/api/services');
      state.services = services;
      state.categories = categories || [...new Set(services.map((s) => s.category))];

      const params = new URLSearchParams(location.search);
      const cat = params.get('category');
      if (cat && state.categories.includes(cat)) state.category = cat;
      const q = params.get('q');
      if (q) { state.query = q; H.qs('#service-search').value = q; }

      renderCategories();
      render();
    } catch (err) {
      H.qs('#results-count').textContent = 'The menu could not load.';
      grid().innerHTML = `<div class="empty" style="grid-column:1/-1">${H.icon('alert')}<p class="body-md">${H.esc(err.message)}</p></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    H.qs('#service-search')?.addEventListener('input', H.debounce((e) => { state.query = e.target.value; render(); }, 160));
    H.qs('#service-sort')?.addEventListener('change', (e) => { state.sort = e.target.value; render(); });
    H.qsa('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      H.qsa('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      render();
    }));
    H.qs('#clear-filters')?.addEventListener('click', () => {
      state.query = ''; state.category = 'all';
      H.qs('#service-search').value = '';
      renderCategories(); render();
    });
    load();
  });
})();
