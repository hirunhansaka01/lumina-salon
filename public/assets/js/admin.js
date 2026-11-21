/* =====================================================================
   Studio admin — overview, appointments, services, clients, inbox,
   working hours, settings. All data comes from the Node API.
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  const state = {
    user: null,
    view: 'overview',
    date: null,
    overview: null,
    appointments: null,
    services: [],
    clients: [],
    messages: [],
    settings: null,
    availability: null,
    pendingClient: null,
  };

  const main = () => H.qs('#admin-content');
  const overlay = () => H.qs('#overlay-root');

  /* ── auth ────────────────────────────────────────────────────── */
  async function boot() {
    try {
      const { user } = await H.api.get('/api/auth/me');
      state.user = user;
      enterApp();
    } catch {
      H.qs('#auth-screen').hidden = false;
      H.hydrate();
      bindLogin();
    }
  }

  function bindLogin() {
    const form = H.qs('#login-form');
    const errNode = H.qs('#login-error');
    const btn = H.qs('#login-btn');

    H.qs('#toggle-password')?.addEventListener('click', (e) => {
      const input = H.qs('#login-password');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      e.currentTarget.textContent = showing ? 'Show' : 'Hide';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errNode.textContent = '';
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.email || !data.password) { errNode.textContent = 'Enter your email and password.'; return; }
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        const res = await H.api.post('/api/auth/login', data);
        state.user = res.user;
        H.qs('#auth-screen').hidden = true;
        enterApp();
      } catch (err) {
        errNode.textContent = err.message;
        btn.disabled = false;
        btn.innerHTML = 'Sign in';
        H.hydrate(btn.parentElement);
      }
    });
  }

  function enterApp() {
    H.qs('#auth-screen').hidden = true;
    H.qs('#admin-app').hidden = false;
    const u = state.user;
    H.qs('#user-name').textContent = u.name;
    H.qs('#user-role').textContent = u.title || u.role;
    H.qs('#user-avatar').textContent = u.initials || H.initials(u.name);

    H.qsa('.admin-link[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    H.qs('#refresh-btn').addEventListener('click', () => navigate(state.view, { force: true }));
    H.qs('#new-booking-btn').addEventListener('click', openNewBooking);
    H.qs('#logout-btn').addEventListener('click', async () => {
      await H.api.post('/api/auth/logout');
      location.reload();
    });

    const initial = (location.hash || '#overview').replace('#', '');
    navigate(['overview', 'appointments', 'services', 'clients', 'messages', 'announcements', 'email', 'hours', 'settings'].includes(initial) ? initial : 'overview');
  }

  /* ── router ──────────────────────────────────────────────────── */
  const TITLES = {
    overview: ['Overview', 'A calm read on today'],
    appointments: ['Appointments', 'Check-in, walk-ins and the day sheet'],
    services: ['Services & pricing', 'Your menu, durations and prices'],
    clients: ['Clients & formulas', 'Notes, history and colour recipes'],
    messages: ['Inbox', 'Enquiries from the website'],
    announcements: ['Announcements', 'What the website says, and when'],
    email: ['Email', 'Your sending account and delivery'],
    hours: ['Working hours', 'Weekly availability for each stylist'],
    settings: ['Settings', 'Booking rules, studio details and security'],
  };

  async function navigate(view, opts = {}) {
    state.view = view;
    location.hash = `#${view}`;
    H.qsa('.admin-link[data-view]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    const [title] = TITLES[view] || ['Overview', ''];
    H.qs('#page-title').textContent = title;

    main().innerHTML = skeletonView();
    try {
      if (view === 'overview') await renderOverview();
      if (view === 'appointments') await renderAppointments();
      if (view === 'services') await renderServices();
      if (view === 'clients') await renderClients();
      if (view === 'messages') await renderMessages();
      if (view === 'announcements') await renderAnnouncements();
      if (view === 'email') await renderEmail();
      if (view === 'hours') await renderHours();
      if (view === 'settings') await renderSettings();
      H.hydrate(main());
      H.reveal(main());
    } catch (err) {
      if (err.status === 401) { location.reload(); return; }
      main().innerHTML = `<div class="empty">${H.icon('alert')}<p class="body-md">${H.esc(err.message)}</p><button class="btn btn-sm btn-outline" onclick="location.reload()">Retry</button></div>`;
    }
  }

  function skeletonView() {
    return `<div class="stat-grid">${'<div class="skeleton" style="height:108px;border-radius:16px"></div>'.repeat(4)}</div>
      <div class="skeleton" style="height:320px;border-radius:16px"></div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     OVERVIEW
     ══════════════════════════════════════════════════════════════ */
  async function renderOverview() {
    const d = await H.api.get('/api/admin/overview');
    state.overview = d;
    state.date = d.date;
    H.qs('#page-sub').textContent = `${d.prettyDate} · ${d.studio.address}`;
    updateBadges(d.stats.pending_requests, d.messages.length);

    const trend = d.stats.revenue_delta_pct;
    const trendChip = trend === null ? '' : `<span class="stat-trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span>`;

    main().innerHTML = `
      <div class="stat-grid">
        <article class="stat-card">
          <div class="stat-label">${H.icon('calendar')}Today's bookings</div>
          <div class="stat-value">${d.stats.today_bookings}</div>
          <div class="stat-sub">${d.stats.pending_requests ? `<span class="chip chip-warning chip-sm">${d.stats.pending_requests} awaiting confirmation</span>` : 'All confirmed'}</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">${H.icon('chair')}In the chair</div>
          <div class="stat-value">${d.stats.in_chair}</div>
          <div class="stat-sub">${d.stats.confirmed} confirmed ahead · ${d.stats.chair_capacity} chairs</div>
        </article>
        <article class="stat-card stat-card-accent">
          <div class="stat-label">${H.icon('card')}Projected revenue</div>
          <div class="stat-value">${H.moneyShort(d.stats.revenue_cents)}</div>
          <div class="stat-sub">${trendChip} ${d.stats.last_week_revenue_cents ? `vs ${H.moneyShort(d.stats.last_week_revenue_cents)} last week` : 'first week'} </div>
        </article>
        <article class="stat-card">
          <div class="stat-label">${H.icon('clock')}Open slots</div>
          <div class="stat-value">${d.stats.open_slots}</div>
          <div class="stat-sub">${d.stats.next_open ? `Next open ${H.time12(d.stats.next_open)}` : 'Fully booked today'}</div>
        </article>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:18px" class="overview-split">
        <!-- day sheet -->
        <section class="card">
          <div class="row-between" style="margin-bottom:6px">
            <div>
              <h2 class="title-lg">Today's schedule</h2>
              <p class="body-sm dim">${d.appointments.length} appointments · ${H.moneyShort(d.stats.revenue_cents)} booked</p>
            </div>
            <button class="btn btn-sm btn-outline" data-goto="appointments">Full day sheet ${H.icon('arrow')}</button>
          </div>
          <div class="timeline mt-sm">
            ${d.appointments.length ? d.appointments.map(apptRow).join('') : `<div class="empty" style="margin-top:12px">${H.icon('calendar')}<p class="body-md">No bookings yet today. Add a walk-in to get started.</p></div>`}
          </div>
        </section>

        <!-- right rail -->
        <div class="stack gap-md">
          <section class="card">
            <div class="row-between" style="margin-bottom:8px">
              <h2 class="title-lg">Open slots</h2>
              <span class="chip chip-primary chip-sm">${d.stats.open_slots} today</span>
            </div>
            ${d.open_slots.length ? `
              <div class="row gap-sm row-wrap">
                ${d.open_slots.map((s) => `<button class="chip chip-outline" data-open-slot="${s.time}" title="${H.esc(s.stylist)}">${H.time12(s.time)}${s.stylist ? ` · ${H.esc(s.stylist.split(' ')[0])}` : ''}</button>`).join('')}
              </div>
              <p class="body-sm dim mt-md">Tap a slot to book it in.</p>` : `<p class="body-sm dim">Every chair is full today. Beautiful.</p>`}
          </section>

          <section class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="title-lg">Colour notes</h2>
              <button class="btn-link" data-goto="clients">All clients ${H.icon('arrow')}</button>
            </div>
            <div class="stack" style="gap:2px">
              ${d.clients.slice(0, 4).map((c) => `
                <button class="mini-row" data-client="${c.id}" style="width:100%;text-align:left">
                  <span class="avatar avatar-sm">${H.initials(c.name)}</span>
                  <span class="mini-main">
                    <span class="mini-name">${H.esc(c.name)}</span>
                    <span class="mini-sub">${c.visit_count ? `${c.visit_count} visits · ${H.moneyShort(c.total_spent_cents)} lifetime` : 'New client'}</span>
                  </span>
                  ${H.icon('chevronRight', 'icon')}
                </button>`).join('')}
            </div>
          </section>

          <section class="card card-inverse">
            <h2 class="title-lg">Tomorrow</h2>
            <p class="body-md mt-sm">${d.tomorrow_count} appointment${d.tomorrow_count === 1 ? '' : 's'} already booked${d.tomorrow_count ? '' : ' — plenty of room'}. ${d.stats.pending_requests ? `Confirm ${d.stats.pending_requests} pending request${d.stats.pending_requests === 1 ? '' : 's'} before the end of the day.` : 'Everything is confirmed.'}</p>
            <button class="btn btn-inverse btn-sm mt-md" data-goto="appointments">Open the day sheet ${H.icon('arrow')}</button>
          </section>
        </div>
      </div>

      ${d.messages.length ? `
      <section class="card">
        <div class="row-between" style="margin-bottom:6px">
          <h2 class="title-lg">New enquiries</h2>
          <button class="btn-link" data-goto="messages">Inbox ${H.icon('arrow')}</button>
        </div>
        ${d.messages.map((m) => `
          <div class="mini-row">
            <span class="avatar avatar-sm avatar-gold">${H.initials(m.name)}</span>
            <span class="mini-main">
              <span class="mini-name">${H.esc(m.name)} · <span class="dim" style="font-weight:400">${H.esc(m.subject || 'Website enquiry')}</span></span>
              <span class="mini-sub clamp-2">${H.esc(m.message)}</span>
            </span>
            <a class="btn btn-sm btn-ghost" href="mailto:${H.esc(m.email)}">Reply</a>
          </div>`).join('')}
      </section>` : ''}

      <section class="card">
        <h2 class="title-lg" style="margin-bottom:10px">Studio activity</h2>
        <div class="stack" style="gap:0">
          ${(d.activity || []).length ? d.activity.map((a) => `
            <div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
              <div class="row gap-sm" style="min-width:0">
                <span class="chip chip-sm chip-outline">${H.esc((a.action || '').replace(/_/g, ' '))}</span>
                <span class="body-sm clamp-2" style="min-width:0">${H.esc(a.detail || '')}</span>
              </div>
              <span class="body-sm dim nowrap">${H.esc(relativeTime(a.created_at))}</span>
            </div>`).join('') : `<p class="body-sm dim">Nothing logged yet today.</p>`}
        </div>
      </section>`;

    H.qsa('[data-goto]', main()).forEach((b) => b.addEventListener('click', () => navigate(b.dataset.goto)));
    H.qsa('[data-status]', main()).forEach(bindStatusButton);
    H.qsa('[data-client]', main()).forEach((b) => b.addEventListener('click', () => openClient(b.dataset.client)));
    H.qsa('[data-open-slot]', main()).forEach((b) => b.addEventListener('click', () => openNewBooking({ time: b.dataset.openSlot })));
  }

  function apptRow(a) {
    const client = a.clients || {};
    const service = a.services || {};
    const stylist = a.stylists || {};
    return `
      <div class="tl-row">
        <div>
          <div class="tl-time">${H.time12(a.time)}</div>
          <div class="tl-dur">${H.duration(a.duration_minutes)}</div>
        </div>
        <div class="tl-main">
          <div class="tl-name">${H.esc(client.name || 'Walk-in')} ${H.statusBadge(a.status)}</div>
          <div class="tl-meta">
            <span>${H.esc(service.name || '')}</span><span class="dot"></span>
            <span>${H.esc(stylist.name || '')}</span><span class="dot"></span>
            <span class="tabular">${H.money(a.price_cents)}</span>
            ${a.source === 'online' ? '<span class="dot"></span><span class="chip chip-sm chip-primary" style="height:18px">online</span>' : ''}
          </div>
        </div>
        <div class="tl-actions">
          ${statusActions(a)}
        </div>
      </div>`;
  }

  function statusActions(a) {
    if (a.status === 'pending') {
      return `<button class="btn btn-sm" data-status="confirmed" data-id="${a.id}">Confirm</button>
              <button class="btn btn-sm btn-ghost" data-status="cancelled" data-id="${a.id}">Decline</button>`;
    }
    if (a.status === 'confirmed') {
      return `<button class="btn btn-sm" data-status="in_chair" data-id="${a.id}">Check in</button>
              <button class="btn btn-icon" style="width:34px;height:34px" data-status="cancelled" data-id="${a.id}" title="Cancel">${H.icon('close', 'icon')}</button>`;
    }
    if (a.status === 'in_chair') {
      return `<button class="btn btn-sm btn-secondary" data-status="completed" data-id="${a.id}">Complete</button>`;
    }
    return `<span class="body-sm dim">${a.status === 'completed' ? 'Paid' : '—'}</span>`;
  }

  function bindStatusButton(btn) {
    btn.addEventListener('click', async () => {
      const { id } = btn.dataset;
      const status = btn.dataset.status;
      btn.disabled = true;
      try {
        await H.api.patch(`/api/admin/appointments/${id}/status`, { status });
        H.toast(`Marked ${H.STATUS_LABEL[status].toLowerCase()}.`);
        navigate(state.view, { force: true });
      } catch (err) {
        H.toast(err.message, { type: 'error' });
        btn.disabled = false;
      }
    });
  }

  function updateBadges(pending, messages) {
    const p = H.qs('#nav-pending');
    const m = H.qs('#nav-messages');
    if (p) { p.hidden = !pending; p.textContent = pending || 0; }
    if (m) { m.hidden = !messages; m.textContent = messages || 0; }
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ══════════════════════════════════════════════════════════════
     APPOINTMENTS
     ══════════════════════════════════════════════════════════════ */
  async function renderAppointments(date) {
    const day = date || state.date || new Date().toLocaleDateString('en-CA');
    state.date = day;
    const d = await H.api.get(`/api/admin/appointments?date=${day}`);
    state.appointments = d;
    H.qs('#page-sub').textContent = `${d.prettyDate} · ${d.total} appointments`;

    main().innerHTML = `
      <div class="card" style="padding:16px">
        <div class="row-between row-wrap gap-md">
          <div class="row gap-sm">
            <button class="btn btn-icon" id="prev-day" aria-label="Previous day">${H.icon('chevronLeft')}</button>
            <label class="sr-only" for="day-picker">Appointment date</label>
            <input class="input" id="day-picker" type="date" value="${day}" style="min-height:42px;width:auto" />
            <button class="btn btn-icon" id="next-day" aria-label="Next day">${H.icon('chevronRight')}</button>
            <button class="btn btn-sm btn-ghost" id="today-btn">Today</button>
          </div>
          <div class="admin-tabs" role="tablist" aria-label="Filter by status">
            <button class="admin-tab" data-status-filter="all" aria-current="page">All (${d.total})</button>
            <button class="admin-tab" data-status-filter="pending">Pending (${d.counts.pending || 0})</button>
            <button class="admin-tab" data-status-filter="confirmed">Confirmed (${d.counts.confirmed || 0})</button>
            <button class="admin-tab" data-status-filter="in_chair">In chair (${d.counts.in_chair || 0})</button>
            <button class="admin-tab" data-status-filter="completed">Completed (${d.counts.completed || 0})</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Time</th><th>Client</th><th>Service</th><th>Stylist</th><th class="num">Price</th><th>Status</th><th style="text-align:right">Action</th></tr>
          </thead>
          <tbody id="appt-rows"></tbody>
        </table>
      </div>`;

    const paint = (filter = 'all') => {
      const list = filter === 'all' ? d.appointments : d.appointments.filter((a) => a.status === filter);
      const body = H.qs('#appt-rows');
      body.innerHTML = list.length ? list.map((a) => `
        <tr data-id="${a.id}">
          <td class="tabular"><strong>${H.time12(a.time)}</strong><div class="body-sm dim">${H.duration(a.duration_minutes)}</div></td>
          <td>
            <button class="row gap-sm" data-client="${a.clients?.id}" style="text-align:left">
              <span class="avatar avatar-sm">${H.initials(a.clients?.name || 'W')}</span>
              <span><span class="title-sm" style="display:block">${H.esc(a.clients?.name || 'Walk-in')}</span><span class="body-sm dim">${H.esc(a.clients?.phone || a.clients?.email || '')}</span></span>
            </button>
          </td>
          <td>${H.esc(a.services?.name || '')}<div class="body-sm dim">${H.esc(a.services?.category || '')}</div></td>
          <td><div class="row gap-sm"><span class="avatar avatar-sm">${H.initials(a.stylists?.name || '')}</span>${H.esc(a.stylists?.name || '')}</div></td>
          <td class="num tabular">${H.money(a.price_cents)}</td>
          <td>${H.statusBadge(a.status)}</td>
          <td style="text-align:right"><div class="row gap-sm" style="justify-content:flex-end">${statusActions(a)}</div></td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="empty" style="border:0">${H.icon('calendar')}<p class="body-md">No appointments for this filter.</p></div></td></tr>`;
      H.qsa('[data-status]', body).forEach(bindStatusButton);
      H.qsa('[data-client]', body).forEach((b) => b.addEventListener('click', () => openClient(b.dataset.client)));
    };

    paint();
    H.qsa('[data-status-filter]').forEach((btn) => btn.addEventListener('click', () => {
      H.qsa('[data-status-filter]').forEach((b) => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'page');
      paint(btn.dataset.statusFilter);
    }));

    const shift = (n) => {
      const dt = new Date(`${day}T12:00:00`);
      dt.setDate(dt.getDate() + n);
      renderAppointments(dt.toLocaleDateString('en-CA'));
    };
    H.qs('#prev-day').addEventListener('click', () => shift(-1));
    H.qs('#next-day').addEventListener('click', () => shift(1));
    H.qs('#today-btn').addEventListener('click', () => renderAppointments(new Date().toLocaleDateString('en-CA')));
    H.qs('#day-picker').addEventListener('change', (e) => renderAppointments(e.target.value));
  }

  /* ══════════════════════════════════════════════════════════════
     SERVICES
     ══════════════════════════════════════════════════════════════ */
  async function renderServices() {
    const { services } = await H.api.get('/api/admin/services');
    state.services = services;
    const active = services.filter((s) => s.is_active);
    H.qs('#page-sub').textContent = `${active.length} live services · ${services.filter((s) => !s.is_active).length} archived`;

    const grouped = active.reduce((acc, s) => {
      (acc[s.category] = acc[s.category] || []).push(s);
      return acc;
    }, {});

    main().innerHTML = `
      <div class="row-between row-wrap gap-md">
        <div class="row gap-sm row-wrap">
          ${Object.keys(grouped).map((c) => `<span class="chip chip-outline chip-sm">${H.esc(c)} · ${grouped[c].length}</span>`).join('')}
        </div>
        <button class="btn" id="add-service">${H.icon('plus')}Add service</button>
      </div>

      <div class="grid grid-3">
        ${active.map((s) => `
          <article class="card service-card${s.image_url ? ' has-photo' : ''}">
            ${s.image_url ? `<div class="service-photo"><img src="${H.esc(s.image_url)}" alt="" loading="lazy" /></div>` : ''}
            <div class="service-card-top">
              <h3>${H.esc(s.name)}</h3>
              ${s.is_featured ? `<span class="chip chip-sm chip-gold">Featured</span>` : (s.badge ? `<span class="chip chip-sm chip-primary">${H.esc(s.badge)}</span>` : '')}
            </div>
            <p class="clamp-2">${H.esc(s.description || '')}</p>
            <div class="service-meta">
              <span class="item">${H.icon('clock')}${H.duration(s.duration_minutes)}</span>
              <span class="item">${H.esc(s.category)}</span>
            </div>
            <div class="service-foot">
              <span class="service-price">${H.money(s.price_cents, { cents: false })}</span>
              <div class="row gap-sm">
                <button class="btn btn-sm btn-outline" data-edit-service="${s.id}">Edit</button>
                <button class="btn btn-icon" style="width:34px;height:34px" data-archive-service="${s.id}" title="Archive">${H.icon('trash', 'icon')}</button>
              </div>
            </div>
          </article>`).join('')}
      </div>

      ${services.some((s) => !s.is_active) ? `
      <section class="card">
        <h2 class="title-lg" style="margin-bottom:10px">Archived</h2>
        <div class="stack" style="gap:0">
          ${services.filter((s) => !s.is_active).map((s) => `
            <div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
              <span class="row gap-sm"><span class="title-sm">${H.esc(s.name)}</span><span class="chip chip-sm chip-outline">${H.money(s.price_cents, { cents: false })}</span></span>
              <button class="btn btn-sm btn-ghost" data-restore-service="${s.id}">Restore</button>
            </div>`).join('')}
        </div>
      </section>` : ''}`;

    H.qs('#add-service').addEventListener('click', () => openServiceModal());
    H.qsa('[data-edit-service]').forEach((b) => b.addEventListener('click', () => openServiceModal(services.find((s) => s.id === b.dataset.editService))));
    H.qsa('[data-archive-service]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Archive this service? It disappears from the public menu; existing bookings keep their details.')) return;
      await H.api.del(`/api/admin/services/${b.dataset.archiveService}`);
      H.toast('Service archived.');
      renderServices();
    }));
    H.qsa('[data-restore-service]').forEach((b) => b.addEventListener('click', async () => {
      await H.api.patch(`/api/admin/services/${b.dataset.restoreService}`, { is_active: true });
      H.toast('Service restored.');
      renderServices();
    }));
  }

  /** File picker → Supabase Storage → image_url on the form. */
  function wireServicePhoto(host, service) {
    const file = H.qs('#s-image-file', host);
    const input = H.qs('#s-image', host);
    const prev = H.qs('#s-image-prev', host);
    const note = H.qs('#s-image-note', host);
    const clear = H.qs('#s-image-clear', host);

    const paint = (url) => {
      prev.innerHTML = url
        ? `<img src="${H.esc(url)}" alt="" />`
        : `<span class="ph-empty">${H.icon('image', 'icon')}</span>`;
      H.hydrate(prev);
    };

    input.addEventListener('change', () => {
      const v = input.value.trim();
      paint(v || null);
      host.dataset.photoCleared = '';
    });

    if (clear) clear.addEventListener('click', () => {
      input.value = '';
      paint(null);
      note.textContent = 'The menu will show the typographic tile instead.';
    });

    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { H.toast('That image is larger than 4 MB — please compress it first.', { type: 'error' }); file.value = ''; return; }
      if (!service || !service.id) {
        H.toast('Save the service first, then upload its photo.', { type: 'info' });
        file.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        note.textContent = 'Uploading…';
        try {
          const r = await H.api.post(`/api/admin/services/${service.id}/photo`, { data_url: reader.result });
          input.value = r.url;
          paint(r.url);
          note.textContent = 'Photo uploaded — the website already shows it.';
          H.toast('Photo updated.');
          if (state.services) {
            const row = state.services.find((x) => x.id === service.id);
            if (row) row.image_url = r.url;
          }
        } catch (err) {
          note.textContent = err.message;
          H.toast('Upload failed.', { type: 'error' });
        } finally { file.value = ''; }
      };
      reader.readAsDataURL(f);
    });
  }

  function openServiceModal(service) {
    const isEdit = !!service;
    const s = service || { name: '', category: 'Haircuts', description: '', duration_minutes: 45, price_cents: 0, badge: '', is_featured: false, is_active: true };
    const host = H.el(`
      <div class="modal-backdrop" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="svc-title">
          <button class="btn btn-icon modal-close" data-close aria-label="Close">${H.icon('close')}</button>
          <h2 class="headline-md" id="svc-title">${isEdit ? 'Edit service' : 'New service'}</h2>
          <p class="body-sm dim mt-sm">Prices and durations appear on the public menu instantly.</p>
          <form class="stack gap-md mt-lg" id="service-form">
            <div class="field">
              <label class="field-label" for="s-name">Name</label>
              <input class="input" id="s-name" name="name" value="${H.esc(s.name)}" required />
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="s-category">Category</label>
                <select class="select" id="s-category" name="category">
                  ${['Haircuts', 'Coloring', 'Treatments', 'Styling', 'Packages'].map((c) => `<option ${c === s.category ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label class="field-label" for="s-badge">Badge</label>
                <input class="input" id="s-badge" name="badge" value="${H.esc(s.badge || '')}" placeholder="Signature, Popular…" />
              </div>
              <div class="field">
                <label class="field-label" for="s-duration">Duration (minutes)</label>
                <input class="input" id="s-duration" name="duration_minutes" type="number" min="15" step="15" value="${s.duration_minutes}" />
              </div>
              <div class="field">
                <label class="field-label" for="s-price">Price (USD)</label>
                <input class="input" id="s-price" name="price" type="number" min="0" step="5" value="${(s.price_cents / 100).toFixed(0)}" />
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="s-description">Description</label>
              <textarea class="textarea" id="s-description" name="description" rows="3" style="min-height:88px">${H.esc(s.description || '')}</textarea>
            </div>
            <div class="field">
              <label class="field-label" for="s-image">Service photo</label>
              <div class="service-photo-edit">
                <span id="s-image-prev">${s.image_url
                  ? `<img src="${H.esc(s.image_url)}" alt="" />`
                  : `<span class="ph-empty">${H.icon('image', 'icon')}</span>`}</span>
                <div class="stack gap-sm">
                  <div class="row gap-sm row-wrap">
                    <label class="btn btn-sm btn-outline" for="s-image-file">${H.icon('upload')}Upload photo</label>
                    <input id="s-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden />
                    ${s.image_url ? `<button class="btn btn-sm btn-ghost" type="button" id="s-image-clear">Use tile instead</button>` : ''}
                  </div>
                  <input class="input" id="s-image" name="image_url" value="${H.esc(s.image_url || '')}" placeholder="https://… or /assets/services/photo.jpg" />
                  <p class="body-sm dim" id="s-image-note">JPG, PNG, WebP or AVIF · up to 4 MB. Uploads go straight to the site.</p>
                </div>
              </div>
            </div>
            <label class="check-row"><input type="checkbox" name="is_featured" ${s.is_featured ? 'checked' : ''} /> <span>Feature on the home page</span></label>
            <div class="row-between mt-sm">
              <button class="btn btn-ghost" type="button" data-close>Cancel</button>
              <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Create service'}</button>
            </div>
          </form>
        </div>
      </div>`);
    openOverlay(host);
    wireServicePhoto(host, s);
    host.querySelector('#service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const payload = {
        name: f.get('name'),
        category: f.get('category'),
        description: f.get('description'),
        duration_minutes: Number(f.get('duration_minutes')),
        price_cents: Math.round(Number(f.get('price')) * 100),
        badge: f.get('badge'),
        image_url: (f.get('image_url') || '').trim() || null,
        is_featured: f.get('is_featured') === 'on',
        is_active: true,
      };
      try {
        if (isEdit) await H.api.patch(`/api/admin/services/${service.id}`, payload);
        else await H.api.post('/api/admin/services', payload);
        H.toast(isEdit ? 'Service updated.' : 'Service created.');
        closeOverlay();
        renderServices();
      } catch (err) { H.toast(err.message, { type: 'error' }); }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     CLIENTS & FORMULAS
     ══════════════════════════════════════════════════════════════ */
  async function renderClients() {
    const d = await H.api.get('/api/admin/clients');
    state.clients = d.clients;
    H.qs('#page-sub').textContent = `${d.stats.total} clients · ${H.moneyShort(d.stats.lifetime_cents)} lifetime value`;

    main().innerHTML = `
      <div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <article class="stat-card">
          <div class="stat-label">${H.icon('users')}Clients</div>
          <div class="stat-value">${d.stats.total}</div>
          <div class="stat-sub">${d.stats.returning} returning</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">${H.icon('card')}Lifetime value</div>
          <div class="stat-value">${H.moneyShort(d.stats.lifetime_cents)}</div>
          <div class="stat-sub">Across all visits</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">${H.icon('calendar')}Upcoming visits</div>
          <div class="stat-value">${d.clients.filter((c) => c.next_appointment).length}</div>
          <div class="stat-sub">Across the next 90 days</div>
        </article>
      </div>

      <div class="card" style="padding:14px">
        <div class="row gap-md row-wrap">
          <div class="input-group flex-1">
            ${H.icon('search')}
            <label class="sr-only" for="client-search">Search clients</label>
            <input class="input" id="client-search" type="search" placeholder="Search by name, email or phone…" />
          </div>
          <button class="btn btn-outline" id="export-clients">${H.icon('arrowUpRight')}Export CSV</button>
          <button class="btn" id="add-client">${H.icon('plus')}Add client</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Contact</th><th>Last visit</th><th>Next visit</th><th class="num">Visits</th><th class="num">Lifetime</th><th></th></tr></thead>
          <tbody id="client-rows"></tbody>
        </table>
      </div>`;

    const paint = (q = '') => {
      const term = q.trim().toLowerCase();
      const list = state.clients.filter((c) => !term || [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(term)));
      H.qs('#client-rows').innerHTML = list.length ? list.map((c) => `
        <tr>
          <td><button class="row gap-sm" data-open-client="${c.id}" style="text-align:left">
            <span class="avatar avatar-sm">${H.initials(c.name)}</span>
            <span><span class="title-sm" style="display:block">${H.esc(c.name)}</span><span class="body-sm dim clamp-2" style="max-width:26ch">${H.esc(c.notes || 'No notes yet')}</span></span>
          </button></td>
          <td><div class="body-sm">${H.esc(c.email)}</div><div class="body-sm dim">${H.esc(c.phone || '—')}</div></td>
          <td class="body-sm">${c.last_appointment ? `${H.dateShort(c.last_appointment.appointment_date)}<div class="dim">${H.esc(c.last_appointment.services?.name || '')}</div>` : '<span class="dim">—</span>'}</td>
          <td class="body-sm">${c.next_appointment ? `${H.dateShort(c.next_appointment.appointment_date)}<div class="dim">${H.time12(c.next_appointment.time)} · ${H.esc(c.next_appointment.stylists?.name || '')}</div>` : '<span class="dim">Not booked</span>'}</td>
          <td class="num tabular">${c.visit_count || 0}</td>
          <td class="num tabular">${H.moneyShort(c.total_spent_cents)}</td>
          <td style="text-align:right"><button class="btn btn-sm btn-ghost" data-open-client="${c.id}">Open</button></td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="empty" style="border:0">${H.icon('users')}<p class="body-md">No clients match that search.</p></div></td></tr>`;
      H.qsa('[data-open-client]').forEach((b) => b.addEventListener('click', () => openClient(b.dataset.openClient)));
    };

    paint();
    H.qs('#client-search').addEventListener('input', H.debounce((e) => paint(e.target.value), 140));
    H.qs('#add-client').addEventListener('click', openNewClient);
    H.qs('#export-clients').addEventListener('click', () => {
      const rows = [['Name', 'Email', 'Phone', 'Visits', 'Lifetime (USD)', 'Notes']].concat(
        state.clients.map((c) => [c.name, c.email, c.phone || '', c.visit_count || 0, ((c.total_spent_cents || 0) / 100).toFixed(2), (c.notes || '').replace(/\n/g, ' ')])
      );
      downloadCSV('lumina-clients.csv', rows);
    });
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    H.toast('Export downloaded.');
  }

  async function openClient(id) {
    if (!id) return;
    try {
      const { client, history, formulas } = await H.api.get(`/api/admin/clients/${id}`);
      const host = H.el(`
        <div>
          <div class="panel-backdrop" data-close></div>
          <aside class="panel" role="dialog" aria-modal="true" aria-labelledby="client-panel-title">
            <div class="panel-head">
              <div class="row gap-md">
                <span class="avatar avatar-lg">${H.initials(client.name)}</span>
                <div>
                  <h2 class="headline-sm" id="client-panel-title">${H.esc(client.name)}</h2>
                  <p class="body-sm dim">${H.esc(client.email)}${client.phone ? ` · ${H.esc(client.phone)}` : ''}</p>
                </div>
              </div>
              <button class="btn btn-icon" data-close aria-label="Close">${H.icon('close')}</button>
            </div>
            <div class="panel-body">
              <div class="grid grid-3" style="gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))">
                <div class="card card-inset" style="padding:12px">
                  <div class="label-sm dim">Visits</div>
                  <div class="headline-sm">${client.visit_count || 0}</div>
                </div>
                <div class="card card-inset" style="padding:12px">
                  <div class="label-sm dim">Lifetime</div>
                  <div class="headline-sm">${H.moneyShort(client.total_spent_cents)}</div>
                </div>
                <div class="card card-inset" style="padding:12px">
                  <div class="label-sm dim">Last visit</div>
                  <div class="headline-sm">${client.last_visit_date ? H.dateShort(client.last_visit_date) : '—'}</div>
                </div>
              </div>

              <div>
                <div class="row-between" style="margin-bottom:8px">
                  <h3 class="title-md">Colour formulas</h3>
                  <button class="btn btn-sm btn-outline" id="add-formula">${H.icon('plus')}Add formula</button>
                </div>
                ${formulas.length ? `<div class="stack gap-sm">${formulas.map((f) => `
                  <div class="formula-note">
                    <div class="row-between">
                      <strong>${H.esc(f.formula)}</strong>
                      <span class="body-sm dim">${f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                    </div>
                    <div class="body-sm mt-sm">${f.developer ? `${H.esc(f.developer)} · ` : ''}${f.processing_minutes ? `${f.processing_minutes} min processing` : ''}</div>
                    ${f.notes ? `<p class="body-sm mt-sm">${H.esc(f.notes)}</p>` : ''}
                  </div>`).join('')}</div>` : `<p class="body-sm dim">No formulas recorded yet.</p>`}
              </div>

              <div>
                <h3 class="title-md" style="margin-bottom:8px">History</h3>
                ${history.length ? `<div class="stack" style="gap:0">${history.map((a) => `
                  <div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
                    <div>
                      <div class="title-sm">${H.esc(a.services?.name || '')}</div>
                      <div class="body-sm dim">${H.dateShort(a.appointment_date)} · ${H.time12(a.time)} · ${H.esc(a.stylists?.name || '')}</div>
                    </div>
                    <div class="row gap-sm">${H.statusBadge(a.status)}<span class="body-sm tabular">${H.money(a.price_cents)}</span></div>
                  </div>`).join('')}</div>` : `<p class="body-sm dim">No appointments yet.</p>`}
              </div>

              <div>
                <h3 class="title-md" style="margin-bottom:8px">Studio notes</h3>
                <textarea class="textarea" id="client-notes" rows="3" style="min-height:80px" placeholder="Preferences, allergies, what worked…">${H.esc(client.notes || '')}</textarea>
                <div class="row-between mt-sm">
                  <span class="body-sm dim">Saved to this client only.</span>
                  <button class="btn btn-sm" id="save-notes">Save notes</button>
                </div>
              </div>
            </div>
            <div class="panel-foot">
              <button class="btn btn-outline flex-1" id="book-client">Book appointment</button>
              <a class="btn btn-ghost" href="mailto:${H.esc(client.email)}">Email</a>
            </div>
          </aside>
        </div>`);
      openOverlay(host);

      host.querySelector('#save-notes').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        try {
          await H.api.patch(`/api/admin/clients/${client.id}`, { notes: host.querySelector('#client-notes').value });
          H.toast('Notes saved.');
        } catch (err) { H.toast(err.message, { type: 'error' }); }
        e.currentTarget.disabled = false;
      });

      host.querySelector('#add-formula').addEventListener('click', () => {
        openFormulaModal(client.id, () => { closeOverlay(); openClient(client.id); });
      });
      host.querySelector('#book-client').addEventListener('click', () => {
        closeOverlay();
        openNewBooking({ clientId: client.id, clientName: client.name, clientEmail: client.email });
      });
    } catch (err) { H.toast(err.message, { type: 'error' }); }
  }

  function openFormulaModal(clientId, onDone) {
    const host = H.el(`
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="formula-title">
          <button class="btn btn-icon modal-close" data-close aria-label="Close">${H.icon('close')}</button>
          <h2 class="headline-md" id="formula-title">New colour formula</h2>
          <p class="body-sm dim mt-sm">Recorded against this client so the next visit is effortless.</p>
          <form class="stack gap-md mt-lg" id="formula-form">
            <div class="field">
              <label class="field-label" for="f-formula">Formula</label>
              <input class="input" id="f-formula" name="formula" placeholder="Clay lightener + 20 vol" required />
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="f-dev">Developer</label>
                <input class="input" id="f-dev" name="developer" placeholder="20 vol" />
              </div>
              <div class="field">
                <label class="field-label" for="f-time">Processing (min)</label>
                <input class="input" id="f-time" name="processing_minutes" type="number" min="0" step="5" placeholder="35" />
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="f-notes">Notes</label>
              <textarea class="textarea" id="f-notes" name="notes" rows="3" style="min-height:84px" placeholder="Tone with 9G + 9NB (1:1) for 15 mins…"></textarea>
            </div>
            <div class="row-between">
              <button class="btn btn-ghost" type="button" data-close>Cancel</button>
              <button class="btn" type="submit">Save formula</button>
            </div>
          </form>
        </div>
      </div>`);
    openOverlay(host);
    host.querySelector('#formula-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        await H.api.post(`/api/admin/clients/${clientId}/formulas`, Object.fromEntries(f.entries()));
        H.toast('Formula saved.');
        closeOverlay();
        onDone && onDone();
      } catch (err) { H.toast(err.message, { type: 'error' }); }
    });
  }

  function openNewClient() {
    const host = H.el(`
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="client-new-title">
          <button class="btn btn-icon modal-close" data-close aria-label="Close">${H.icon('close')}</button>
          <h2 class="headline-md" id="client-new-title">Add a client</h2>
          <form class="stack gap-md mt-lg" id="new-client-form">
            <div class="field"><label class="field-label" for="nc-name">Name</label><input class="input" id="nc-name" name="name" required /></div>
            <div class="form-grid">
              <div class="field"><label class="field-label" for="nc-email">Email</label><input class="input" id="nc-email" name="email" type="email" placeholder="optional" /></div>
              <div class="field"><label class="field-label" for="nc-phone">Phone</label><input class="input" id="nc-phone" name="phone" type="tel" /></div>
            </div>
            <div class="field"><label class="field-label" for="nc-notes">Notes</label><textarea class="textarea" id="nc-notes" name="notes" rows="3" style="min-height:80px"></textarea></div>
            <div class="row-between">
              <button class="btn btn-ghost" type="button" data-close>Cancel</button>
              <button class="btn" type="submit">Add client</button>
            </div>
          </form>
        </div>
      </div>`);
    openOverlay(host);
    host.querySelector('#new-client-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await H.api.post('/api/admin/clients', Object.fromEntries(new FormData(e.currentTarget).entries()));
        H.toast('Client added.');
        closeOverlay();
        renderClients();
      } catch (err) { H.toast(err.message, { type: 'error' }); }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     NEW BOOKING (walk-in / phone)
     ══════════════════════════════════════════════════════════════ */
  async function openNewBooking(prefill = {}) {
    try {
      const [{ services }, { stylists }] = await Promise.all([
        H.api.get('/api/services'),
        H.api.get('/api/stylists'),
      ]);
      const today = new Date().toLocaleDateString('en-CA');
      const host = H.el(`
        <div class="modal-backdrop">
          <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="nb-title">
            <button class="btn btn-icon modal-close" data-close aria-label="Close">${H.icon('close')}</button>
            <h2 class="headline-md" id="nb-title">New booking</h2>
            <p class="body-sm dim mt-sm">Walk-ins and phone bookings land straight on the day sheet.</p>
            <form class="stack gap-md mt-lg" id="nb-form">
              <div class="form-grid">
                <div class="field">
                  <label class="field-label" for="nb-name">Client name</label>
                  <input class="input" id="nb-name" name="client_name" value="${H.esc(prefill.clientName || '')}" required />
                </div>
                <div class="field">
                  <label class="field-label" for="nb-email">Email</label>
                  <input class="input" id="nb-email" name="client_email" type="email" value="${H.esc(prefill.clientEmail || '')}" placeholder="optional" />
                </div>
                <div class="field">
                  <label class="field-label" for="nb-phone">Phone</label>
                  <input class="input" id="nb-phone" name="client_phone" type="tel" placeholder="optional" />
                </div>
                <div class="field">
                  <label class="field-label" for="nb-service">Service</label>
                  <select class="select" id="nb-service" name="service_id" required>
                    ${services.map((s) => `<option value="${s.id}">${H.esc(s.name)} · ${H.duration(s.duration_minutes)} · ${H.money(s.price_cents, { cents: false })}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label class="field-label" for="nb-stylist">Stylist</label>
                  <select class="select" id="nb-stylist" name="stylist_id" required>
                    ${stylists.map((s) => `<option value="${s.id}">${H.esc(s.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label class="field-label" for="nb-date">Date</label>
                  <input class="input" id="nb-date" name="appointment_date" type="date" value="${state.date || today}" required />
                </div>
                <div class="field">
                  <label class="field-label" for="nb-time">Time</label>
                  <input class="input" id="nb-time" name="time" type="time" value="${prefill.time || '10:00'}" step="900" required />
                </div>
                <div class="field">
                  <label class="field-label" for="nb-status">Status</label>
                  <select class="select" id="nb-status" name="status">
                    <option value="confirmed">Confirmed</option>
                    <option value="in_chair">In chair now</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div class="field span-2">
                  <label class="field-label" for="nb-notes">Notes</label>
                  <input class="input" id="nb-notes" name="notes" placeholder="Anything the stylist should know" />
                </div>
              </div>
              <div class="row-between">
                <button class="btn btn-ghost" type="button" data-close>Cancel</button>
                <button class="btn" type="submit">Save booking</button>
              </div>
            </form>
          </div>
        </div>`);
      openOverlay(host);
      host.querySelector('#nb-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
        payload.source = 'walk_in';
        try {
          await H.api.post('/api/admin/appointments', payload);
          H.toast('Booking added to the day sheet.');
          closeOverlay();
          navigate(state.view === 'overview' ? 'overview' : 'appointments', { force: true });
        } catch (err) { H.toast(err.message, { type: 'error' }); }
      });
    } catch (err) { H.toast(err.message, { type: 'error' }); }
  }

  /* ══════════════════════════════════════════════════════════════
     INBOX
     ══════════════════════════════════════════════════════════════ */
  async function renderMessages() {
    const { messages } = await H.api.get('/api/admin/messages');
    state.messages = messages;
    const fresh = messages.filter((m) => m.status === 'new');
    updateBadges(state.overview?.stats?.pending_requests || 0, fresh.length);
    H.qs('#page-sub').textContent = `${messages.length} messages · ${fresh.length} unread`;

    main().innerHTML = messages.length ? `
      <div class="stack gap-md">
        ${messages.map((m) => `
          <article class="card" style="padding:20px">
            <div class="row-between" style="align-items:flex-start;gap:16px">
              <div class="row gap-md" style="min-width:0">
                <span class="avatar ${m.status === 'new' ? 'avatar-gold' : ''}">${H.initials(m.name)}</span>
                <div style="min-width:0">
                  <div class="row gap-sm row-wrap">
                    <h3 class="title-md">${H.esc(m.name)}</h3>
                    ${m.status === 'new' ? '<span class="chip chip-warning chip-sm">New</span>' : `<span class="chip chip-sm chip-outline">${H.esc(m.status)}</span>`}
                  </div>
                  <p class="body-sm dim">${H.esc(m.email)}${m.phone ? ` · ${H.esc(m.phone)}` : ''} · ${relativeTime(m.created_at)}</p>
                </div>
              </div>
              <div class="row gap-sm">
                <a class="btn btn-sm" href="mailto:${H.esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message to Lumina Salon'))}">Reply</a>
                ${m.status === 'new' ? `<button class="btn btn-sm btn-ghost" data-mark-read="${m.id}">Mark read</button>` : ''}
              </div>
            </div>
            <p class="title-sm mt-md">${H.esc(m.subject || 'Website enquiry')}</p>
            <p class="body-md mt-sm">${H.esc(m.message)}</p>
          </article>`).join('')}
      </div>` : `<div class="empty">${H.icon('mail')}<h3 class="headline-sm">Inbox zero</h3><p class="body-md">New enquiries from the website appear here.</p></div>`;

    H.qsa('[data-mark-read]').forEach((b) => b.addEventListener('click', async () => {
      await H.api.patch(`/api/admin/messages/${b.dataset.markRead}`, { status: 'read' });
      renderMessages();
    }));
  }

  /* ══════════════════════════════════════════════════════════════
     ANNOUNCEMENTS — the bar at the top of the website, with a window
     ══════════════════════════════════════════════════════════════ */
  const VARIANTS = [
    { key: 'info', label: 'Forest (default)' },
    { key: 'gold', label: 'Gold — seasonal' },
    { key: 'plum', label: 'Plum — editorial' },
    { key: 'urgent', label: 'Red — notice' },
  ];

  const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const liveState = (a) => {
    if (!a.is_active) return { label: 'Paused', cls: 'chip-outline' };
    const now = Date.now();
    if (a.starts_at && new Date(a.starts_at).getTime() > now) return { label: 'Scheduled', cls: 'chip-primary' };
    if (a.ends_at && new Date(a.ends_at).getTime() < now) return { label: 'Expired', cls: 'chip-outline' };
    return { label: 'Live now', cls: 'chip-gold' };
  };

  async function renderAnnouncements() {
    const { announcements } = await H.api.get('/api/admin/announcements');
    state.announcements = announcements;
    H.qs('#page-sub').textContent = 'The bar above the website header — schedule it, email it, or both';

    main().innerHTML = `
      <div class="row-between" style="align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px">
        <p class="body-md" style="max-width:62ch;margin:0">
          Anything live shows on every page. Give it a start and end time and it appears and disappears on its own —
          ideal for “Now booking December colour”, holiday hours, or a last-minute opening.
        </p>
        <button class="btn" id="add-announcement">${H.icon('plus')}New announcement</button>
      </div>

      ${announcements.length ? `<div class="stack gap-md">${announcements.map((a) => {
        const live = liveState(a);
        return `
        <article class="card ann-card" data-variant="${H.esc(a.variant)}">
          <div class="row-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="min-width:0;flex:1">
              <div class="row gap-sm row-wrap" style="align-items:center">
                <h3 class="title-md">${H.esc(a.title)}</h3>
                <span class="chip chip-sm ${live.cls}">${live.label}</span>
                ${a.sent_at ? `<span class="chip chip-sm chip-outline">Emailed to ${a.sent_count}</span>` : ''}
              </div>
              <div class="ann-preview mt-sm" data-variant="${H.esc(a.variant)}">${H.esc(a.message || a.title)}</div>
              <p class="body-sm dim" style="margin-top:10px">
                ${a.starts_at ? `Starts ${H.esc(fmtWhen(a.starts_at))}` : 'Starts immediately'}
                ·
                ${a.ends_at ? `Ends ${H.esc(fmtWhen(a.ends_at))}` : 'Runs until paused'}
                ${a.link_url ? ` · Links to ${H.esc(a.link_url)}` : ''}
              </p>
            </div>
            <div class="row gap-sm" style="flex-wrap:wrap">
              <button class="btn btn-sm btn-outline" data-edit-ann="${a.id}">Edit</button>
              <button class="btn btn-sm btn-ghost" data-toggle-ann="${a.id}">${a.is_active ? 'Pause' : 'Resume'}</button>
              <button class="btn btn-sm btn-ghost" data-send-ann="${a.id}">Email to clients</button>
              <button class="btn btn-icon" style="width:34px;height:34px" data-del-ann="${a.id}" title="Delete">${H.icon('trash','icon')}</button>
            </div>
          </div>
        </article>`;
      }).join('')}</div>` : `
      <div class="empty">
        ${H.icon('sparkle')}
        <h3 class="headline-sm">No announcements yet</h3>
        <p class="body-md" style="max-width:40ch;margin-inline:auto">
          Create one and it appears instantly. Example: “Now booking December colour — bespoke balayage and gloss appointments open.”
        </p>
        <button class="btn btn-sm" data-example>Use that example</button>
      </div>`}
    `;

    H.qs('#add-announcement').addEventListener('click', () => openAnnouncement());
    const ex = H.qs('[data-example]');
    if (ex) ex.addEventListener('click', () => openAnnouncement({
      title: 'Now booking December colour',
      message: 'Now booking December colour — bespoke balayage and gloss appointments open.',
      link_label: 'Book a chair',
      link_url: '/booking',
      variant: 'gold',
      is_active: true,
    }));
    H.qsa('[data-edit-ann]').forEach((b) => b.addEventListener('click', () => openAnnouncement(announcements.find((a) => a.id === b.dataset.editAnn))));
    H.qsa('[data-toggle-ann]').forEach((b) => b.addEventListener('click', async () => {
      const a = announcements.find((x) => x.id === b.dataset.toggleAnn);
      await H.api.patch(`/api/admin/announcements/${a.id}`, { ...a, is_active: !a.is_active });
      H.toast(a.is_active ? 'Announcement paused.' : 'Announcement is live again.');
      renderAnnouncements();
    }));
    H.qsa('[data-del-ann]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this announcement? The bar disappears from the site.')) return;
      await H.api.del(`/api/admin/announcements/${b.dataset.delAnn}`);
      H.toast('Announcement deleted.');
      renderAnnouncements();
    }));
    H.qsa('[data-send-ann]').forEach((b) => b.addEventListener('click', async () => {
      const a = announcements.find((x) => x.id === b.dataset.sendAnn);
      const check = await H.api.post(`/api/admin/announcements/${a.id}/send`, { dry_run: true }).catch((e) => ({ error: e.message }));
      if (check.error) return H.toast(check.error, { type: 'error' });
      const list = check.recipients || [];
      if (!confirm(`Email “${a.title}” to ${list.length} client${list.length === 1 ? '' : 's'}?`)) return;
      b.disabled = true; b.textContent = 'Sending…';
      try {
        const r = await H.api.post(`/api/admin/announcements/${a.id}/send`, {});
        H.toast(`Sent to ${r.sent} client${r.sent === 1 ? '' : 's'}${r.failed ? ` · ${r.failed} failed` : ''}.`);
        renderAnnouncements();
      } catch (err) { H.toast(err.message, { type: 'error' }); b.disabled = false; b.textContent = 'Email to clients'; }
    }));
  }

  function openAnnouncement(a) {
    const isEdit = !!a;
    const d = a || { title: '', message: '', link_label: 'Book a chair', link_url: '/booking', variant: 'info', is_active: true };
    const host = H.el(`
      <div class="modal-backdrop" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ann-title">
          <button class="btn btn-icon modal-close" data-close aria-label="Close">${H.icon('close')}</button>
          <h2 class="headline-md" id="ann-title">${isEdit ? 'Edit announcement' : 'New announcement'}</h2>
          <p class="body-sm dim mt-sm">Shows in the bar above the header on every page.</p>
          <form class="stack gap-md mt-lg" id="ann-form">
            <div class="field"><label class="field-label" for="a-title">Heading <span class="dim">(used as the email subject)</span></label>
              <input class="input" id="a-title" name="title" value="${H.esc(d.title)}" placeholder="Now booking December colour" required /></div>
            <div class="field"><label class="field-label" for="a-message">Message</label>
              <textarea class="textarea" id="a-message" name="message" rows="2" style="min-height:70px" placeholder="Now booking December colour — bespoke balayage and gloss appointments open.">${H.esc(d.message || '')}</textarea></div>
            <div class="form-grid">
              <div class="field"><label class="field-label" for="a-link-label">Link label</label>
                <input class="input" id="a-link-label" name="link_label" value="${H.esc(d.link_label || '')}" placeholder="Book a chair" /></div>
              <div class="field"><label class="field-label" for="a-link-url">Link URL</label>
                <input class="input" id="a-link-url" name="link_url" value="${H.esc(d.link_url || '')}" placeholder="/booking" /></div>
            </div>
            <div class="form-grid">
              <div class="field"><label class="field-label" for="a-variant">Colour</label>
                <select class="select" id="a-variant" name="variant">
                  ${VARIANTS.map((v) => `<option value="${v.key}" ${d.variant === v.key ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select></div>
              <div class="field"><label class="field-label" for="a-active">Status</label>
                <select class="select" id="a-active" name="is_active">
                  <option value="1" ${d.is_active ? 'selected' : ''}>Active</option>
                  <option value="0" ${!d.is_active ? 'selected' : ''}>Paused</option>
                </select></div>
            </div>
            <div class="form-grid">
              <div class="field"><label class="field-label" for="a-starts">Show from <span class="dim">(optional)</span></label>
                <input class="input" id="a-starts" name="starts_at" type="datetime-local" value="${toLocalInput(d.starts_at)}" /></div>
              <div class="field"><label class="field-label" for="a-ends">Hide after <span class="dim">(optional)</span></label>
                <input class="input" id="a-ends" name="ends_at" type="datetime-local" value="${toLocalInput(d.ends_at)}" /></div>
            </div>
            <div class="ann-preview" id="a-preview" data-variant="${H.esc(d.variant)}">${H.esc(d.message || d.title || 'Your message appears here')}</div>
            <div class="row-between mt-sm">
              <button class="btn btn-ghost" type="button" data-close>Cancel</button>
              <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Publish announcement'}</button>
            </div>
          </form>
        </div>
      </div>`);
    openOverlay(host);
    H.hydrate(host);

    const msg = H.qs('#a-message', host), prev = H.qs('#a-preview', host), titleIn = H.qs('#a-title', host), variant = H.qs('#a-variant', host);
    const sync = () => {
      prev.textContent = msg.value || titleIn.value || 'Your message appears here';
      prev.dataset.variant = variant.value;
    };
    [msg, titleIn, variant].forEach((el) => el.addEventListener('input', sync));

    H.qs('#ann-form', host).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const toISO = (v) => (v ? new Date(v).toISOString() : null);
      const payload = {
        title: f.get('title'),
        message: f.get('message'),
        link_label: f.get('link_label'),
        link_url: f.get('link_url'),
        variant: f.get('variant'),
        is_active: f.get('is_active') === '1',
        starts_at: toISO(f.get('starts_at')),
        ends_at: toISO(f.get('ends_at')),
      };
      try {
        if (isEdit) await H.api.patch(`/api/admin/announcements/${a.id}`, payload);
        else await H.api.post('/api/admin/announcements', payload);
        H.toast(isEdit ? 'Announcement updated.' : 'Announcement published.');
        closeOverlay(); renderAnnouncements();
      } catch (err) { H.toast(err.message, { type: 'error' }); }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     EMAIL — sending account, connection test
     ══════════════════════════════════════════════════════════════ */
  async function renderEmail() {
    const { email } = await H.api.get('/api/admin/email/status');
    H.qs('#page-sub').textContent = 'Transactional email for bookings and client notices';

    main().innerHTML = `
      <div class="grid grid-2" style="align-items:start">
        <section class="card">
          <h2 class="title-lg">Sending account</h2>
          <div class="mail-status mt-md">
            <span class="mail-dot ${email.configured ? 'is-on' : 'is-off'}"></span>
            <strong class="title-sm">${email.configured ? 'Connected' : 'Not configured'}</strong>
            <span class="chip chip-sm ${email.configured ? 'chip-primary' : 'chip-outline'}">${H.esc(email.host || 'no credentials')}</span>
          </div>
          ${email.configured ? `
          <dl class="mail-kv mt-lg">
            <dt>Server</dt><dd>${H.esc(email.host)}:${email.port}</dd>
            <dt>Username</dt><dd>${H.esc(email.user)}</dd>
            <dt>Sends as</dt><dd>${H.esc(email.from)}</dd>
            <dt>Studio alerts to</dt><dd>${H.esc(email.notify)}</dd>
          </dl>` : `
          <p class="body-md mt-md">Add <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code> and
          <code>SMTP_PASS</code> to the Vercel project (Settings → Environment Variables), then redeploy.
          Nothing is stored in the repository.</p>`}
        </section>

        <section class="card">
          <h2 class="title-lg">Send a test</h2>
          <p class="body-sm dim">Confirms the login works and shows you exactly how a client email looks.</p>
          <form class="stack gap-md mt-md" id="mail-test-form">
            <div class="field"><label class="field-label" for="mail-test-to">Send to</label>
              <input class="input" id="mail-test-to" name="to" type="email" value="${H.esc(state.user.email)}" required /></div>
            <button class="btn" type="submit">${H.icon('mail')}Send test email</button>
          </form>
          <div id="mail-test-out" class="mt-md"></div>
        </section>

        <section class="card" style="grid-column:1/-1">
          <h2 class="title-lg">What gets sent, and when</h2>
          <div class="table-wrap mt-md">
            <table class="table">
              <thead><tr><th>Email</th><th>Trigger</th><th>Goes to</th></tr></thead>
              <tbody>
                <tr><td>Booking request / confirmation</td><td>Client books online</td><td>Client</td></tr>
                <tr><td>Booking alert</td><td>Client books online</td><td>Studio inbox</td></tr>
                <tr><td>Appointment confirmed</td><td>You confirm a request</td><td>Client</td></tr>
                <tr><td>Appointment moved</td><td>You change the date or time</td><td>Client</td></tr>
                <tr><td>Appointment cancelled</td><td>You cancel</td><td>Client</td></tr>
                <tr><td>Website enquiry</td><td>Contact form submitted</td><td>Studio inbox</td></tr>
                <tr><td>Announcement</td><td>You press “Email to clients”</td><td>Every client with an email</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>`;

    H.qs('#mail-test-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget.querySelector('button');
      const out = H.qs('#mail-test-out');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await H.api.post('/api/admin/email/test', { to: H.qs('#mail-test-to').value });
        out.innerHTML = `<div class="card card-inset"><p class="body-md">${H.esc(r.message)}</p></div>`;
        H.toast('Test email sent.');
      } catch (err) {
        out.innerHTML = `<div class="card card-inset" style="border-color:var(--danger)"><p class="body-md">${H.esc(err.message)}</p></div>`;
        H.toast('Send failed.', { type: 'error' });
      } finally { btn.disabled = false; btn.innerHTML = `${H.icon('mail')}Send test email`; }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     WORKING HOURS
     ══════════════════════════════════════════════════════════════ */
  async function renderHours() {
    const d = await H.api.get('/api/admin/availability');
    state.availability = d;
    H.qs('#page-sub').textContent = 'Weekly availability per stylist';
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    main().innerHTML = `
      <div class="grid grid-2">
        ${d.stylists.filter((s) => s.is_active).map((s) => {
          const rows = DAYS.map((label, weekday) => {
            const row = d.availability.find((a) => a.stylist_id === s.id && a.weekday === weekday) || { weekday, is_working: false, start_time: '09:00', end_time: '19:00', break_start: '13:00', break_end: '13:30' };
            return `
              <div class="hours-row" data-stylist="${s.id}">
                <span class="hours-day">${label}</span>
                <label class="switch">
                  <input type="checkbox" data-day="${weekday}" ${row.is_working ? 'checked' : ''} aria-label="${label} working" />
                  <span class="switch-track"></span>
                </label>
                <input class="input" type="time" value="${row.start_time || '09:00'}" data-start="${weekday}" aria-label="${label} start" />
                <input class="input" type="time" value="${row.end_time || '19:00'}" data-end="${weekday}" aria-label="${label} end" />
              </div>`;
          }).join('');
          return `
            <section class="card">
              <div class="row-between" style="margin-bottom:6px">
                <div class="row gap-sm">
                  <span class="avatar avatar-sm">${s.avatar_initials || H.initials(s.name)}</span>
                  <div><h2 class="title-md">${H.esc(s.name)}</h2><p class="body-sm dim">${H.esc(s.title || '')}</p></div>
                </div>
                <button class="btn btn-sm" data-save-hours="${s.id}">Save</button>
              </div>
              <div class="mt-sm">${rows}</div>
              <p class="body-sm dim mt-md">Both chairs take a 1:00–1:30pm break — online booking skips that window automatically.</p>
            </section>`;
        }).join('')}
      </div>`;

    H.qsa('[data-save-hours]').forEach((btn) => btn.addEventListener('click', async () => {
      const stylistId = btn.dataset.saveHours;
      const section = btn.closest('.card');
      const rows = H.qsa('.hours-row', section).map((r) => ({
        weekday: Number(r.querySelector('[data-day]').dataset.day),
        is_working: r.querySelector('[data-day]').checked,
        start_time: r.querySelector('[data-start]').value,
        end_time: r.querySelector('[data-end]').value,
        break_start: '13:00',
        break_end: '13:30',
      }));
      btn.disabled = true;
      try {
        await H.api.put('/api/admin/availability', { stylist_id: stylistId, rows });
        H.toast('Working hours saved.');
      } catch (err) { H.toast(err.message, { type: 'error' }); }
      btn.disabled = false;
    }));
  }

  /* ══════════════════════════════════════════════════════════════
     SETTINGS
     ══════════════════════════════════════════════════════════════ */
  async function renderSettings() {
    const { settings } = await H.api.get('/api/admin/settings');
    state.settings = settings;
    H.qs('#page-sub').textContent = 'Booking rules, studio details and security';

    main().innerHTML = `
      <div class="grid grid-2" style="align-items:start">
        <section class="card">
          <h2 class="title-lg">Booking rules</h2>
          <p class="body-sm dim">These control what clients can pick on the website.</p>
          <form class="stack gap-md mt-md" id="rules-form">
            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="set-interval">Slot interval (min)</label>
                <input class="input" id="set-interval" name="slot_interval_minutes" type="number" min="15" step="15" value="${settings.slot_interval_minutes}" />
              </div>
              <div class="field">
                <label class="field-label" for="set-lead">Minimum notice (min)</label>
                <input class="input" id="set-lead" name="lead_time_minutes" type="number" min="0" step="30" value="${settings.lead_time_minutes}" />
              </div>
              <div class="field">
                <label class="field-label" for="set-advance">Book ahead (days)</label>
                <input class="input" id="set-advance" name="max_advance_days" type="number" min="7" step="1" value="${settings.max_advance_days}" />
              </div>
              <div class="field">
                <label class="field-label" for="set-cancel">Free cancellation (hours)</label>
                <input class="input" id="set-cancel" name="cancellation_hours" type="number" min="0" step="1" value="${settings.cancellation_hours}" />
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" name="booking_auto_confirm" ${settings.booking_auto_confirm ? 'checked' : ''} />
              <span class="switch-track"></span>
              <span class="body-md">Auto-confirm online bookings <span class="dim">(off = requests you approve)</span></span>
            </label>
            <button class="btn" type="submit">Save booking rules</button>
          </form>
        </section>

        <section class="card">
          <h2 class="title-lg">Studio details</h2>
          <p class="body-sm dim">Shown across the website and in confirmations.</p>
          <form class="stack gap-md mt-md" id="studio-form">
            <div class="field"><label class="field-label" for="set-address">Address</label><input class="input" id="set-address" name="studio_address" value="${H.esc(settings.studio_address)}" /></div>
            <div class="form-grid">
              <div class="field"><label class="field-label" for="set-phone">Phone</label><input class="input" id="set-phone" name="studio_phone" value="${H.esc(settings.studio_phone)}" /></div>
              <div class="field"><label class="field-label" for="set-email">Email</label><input class="input" id="set-email" name="studio_email" type="email" value="${H.esc(settings.studio_email)}" /></div>
            </div>
            <div class="field">
              <label class="field-label" for="set-announce">Announcement bar <span class="dim">(fallback text)</span></label>
              <input class="input" id="set-announce" name="announcement" value="${H.esc(settings.announcement)}" placeholder="Leave blank to hide the bar" />
              <p class="body-sm dim" style="margin-top:6px">
                A live <a href="#announcements">announcement</a> takes precedence — this plain line only shows when none is scheduled.
              </p>
            </div>
            <button class="btn" type="submit">Save studio details</button>
          </form>
        </section>

        <section class="card">
          <h2 class="title-lg">Your password</h2>
          <p class="body-sm dim">Sign in with ${H.esc(state.user.email)}.</p>
          <form class="stack gap-md mt-md" id="password-form">
            <div class="field"><label class="field-label" for="pw-current">Current password</label><input class="input" id="pw-current" name="current_password" type="password" autocomplete="current-password" required /></div>
            <div class="field"><label class="field-label" for="pw-new">New password</label><input class="input" id="pw-new" name="new_password" type="password" autocomplete="new-password" minlength="8" required /></div>
            <button class="btn btn-outline" type="submit">Update password</button>
          </form>
        </section>

        <section class="card">
          <h2 class="title-lg">Studio team</h2>
          <div class="stack mt-md" style="gap:10px">
            ${(await H.api.get('/api/auth/team')).team.map((t) => `
              <div class="row-between" style="padding-bottom:10px;border-bottom:1px solid var(--line-soft)">
                <div class="row gap-sm">
                  <span class="avatar avatar-sm">${H.initials(t.name)}</span>
                  <div><div class="title-sm">${H.esc(t.name)}</div><div class="body-sm dim">${H.esc(t.email)}</div></div>
                </div>
                <span class="chip chip-sm chip-outline">${H.esc(t.role)}</span>
              </div>`).join('')}
          </div>
          <p class="body-sm dim mt-md">Add more team members by running <code>scripts/setup-db.js</code> with a different email, or insert an <code>admin_users</code> row in Supabase.</p>
        </section>
      </div>`;

    H.qs('#rules-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const payload = {
        slot_interval_minutes: Number(f.get('slot_interval_minutes')),
        lead_time_minutes: Number(f.get('lead_time_minutes')),
        max_advance_days: Number(f.get('max_advance_days')),
        cancellation_hours: Number(f.get('cancellation_hours')),
        booking_auto_confirm: f.get('booking_auto_confirm') === 'on',
      };
      try { await H.api.put('/api/admin/settings', payload); H.toast('Booking rules saved.'); }
      catch (err) { H.toast(err.message, { type: 'error' }); }
    });

    H.qs('#studio-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
      try { await H.api.put('/api/admin/settings', payload); H.toast('Studio details saved.'); }
      catch (err) { H.toast(err.message, { type: 'error' }); }
    });

    H.qs('#password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
      try {
        await H.api.post('/api/auth/password', payload);
        H.toast('Password updated.');
        e.currentTarget.reset();
      } catch (err) { H.toast(err.message, { type: 'error' }); }
    });
  }

  /* ── overlay helpers ─────────────────────────────────────────── */
  let releaseTrap = null;
  function openOverlay(node) {
    overlay().innerHTML = '';
    overlay().appendChild(node);
    document.body.style.overflow = 'hidden';
    node.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
    document.addEventListener('keydown', escClose);
    const dialog = node.querySelector('.modal, .panel');
    if (dialog) { releaseTrap = H.trapFocus(dialog); setTimeout(() => dialog.querySelector('input, select, textarea, button')?.focus(), 60); }
  }
  function closeOverlay() {
    overlay().innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escClose);
    if (releaseTrap) { releaseTrap(); releaseTrap = null; }
  }
  function escClose(e) { if (e.key === 'Escape') closeOverlay(); }

  window.addEventListener('hashchange', () => {
    if (!state.user) return;
    const view = location.hash.replace('#', '');
    if (TITLES[view] && view !== state.view) navigate(view);
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
