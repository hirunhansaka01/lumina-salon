/* =====================================================================
   Booking flow — service → stylist → date/time → details → confirmation
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  const state = {
    services: [],
    stylists: [],
    service: null,
    stylist: null,
    date: null,
    time: null,
    slots: [],
    days: [],
    weekStart: 0,
  };

  const dom = {};

  /* ── helpers ─────────────────────────────────────────────────── */
  const todayISO = () => new Date().toLocaleDateString('en-CA');
  const addDays = (iso, n) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  };

  function setStepState() {
    const steps = { service: !!state.service, stylist: !!state.stylist, time: !!(state.date && state.time), details: false };
    Object.entries(steps).forEach(([key, done]) => {
      const card = H.qs(`[data-step="${key}"]`);
      if (!card) return;
      card.dataset.complete = String(done);
    });
    // unlock progressively
    H.qs('[data-step="stylist"]').classList.toggle('is-locked', !state.service);
    H.qs('[data-step="time"]').classList.toggle('is-locked', !state.stylist);
    H.qs('[data-step="details"]').classList.toggle('is-locked', !(state.date && state.time));

    const stage = !state.service ? 1 : !state.stylist ? 2 : !(state.date && state.time) ? 3 : 4;
    H.qsa('[data-step-marker]').forEach((node) => {
      const n = Number(node.dataset.stepMarker);
      node.classList.toggle('is-active', n === stage);
      node.classList.toggle('is-done', n < stage);
    });
  }

  function updateMobileSummary() {
    const bar = H.qs('#mobile-sum');
    if (!bar) return;
    const title = H.qs('#m-sum-title');
    const sub = H.qs('#m-sum-sub');
    const total = H.qs('#m-sum-total');
    const next = H.qs('#m-sum-next');
    const chosen = !!state.service;
    bar.classList.toggle('is-visible', chosen);
    if (!chosen) return;
    title.textContent = state.service.name;
    sub.textContent = [state.stylist?.name, state.date ? H.dateShort(state.date) : null, state.time ? H.time12(state.time) : null]
      .filter(Boolean).join(' · ') || 'Choose a stylist';
    total.textContent = H.money(state.service.price_cents, { cents: false });
    next.textContent = state.time ? 'Confirm' : state.stylist ? 'Pick a time' : 'Pick a stylist';
  }

  function updateSummary() {
    dom.sumService.textContent = state.service ? state.service.name : 'Not chosen';
    dom.sumStylist.textContent = state.stylist ? state.stylist.name : 'Any preference';
    dom.sumDate.textContent = state.date ? H.dateShort(state.date) : 'Choose a day';
    dom.sumTime.textContent = state.time ? H.time12(state.time) : 'Choose a slot';
    dom.sumTotal.textContent = state.service ? H.money(state.service.price_cents, { cents: false }) : '$0';
    dom.sumDuration.textContent = state.service ? `· ${H.duration(state.service.duration_minutes)}` : '';
    if (state.service) {
      dom.sumNote.textContent = 'No deposit required. Pay in the studio after your service.';
    }
    updateMobileSummary();
  }

  /* ── 1 · services ────────────────────────────────────────────── */
  function renderServices() {
    const mount = dom.servicePicks;
    if (!state.services.length) {
      mount.innerHTML = `<div class="empty">${H.icon('alert')}<p class="body-md">The menu could not load. Please call the studio on (555) 019-8234.</p></div>`;
      return;
    }
    mount.innerHTML = state.services.map((s) => `
      <button class="pick" type="button" data-service="${s.id}" aria-pressed="${state.service?.id === s.id}">
        <span class="pick-check" aria-hidden="true"></span>
        ${s.image_thumb ? `<span class="pick-thumb"><img src="${H.esc(s.image_thumb)}" alt="" loading="lazy" decoding="async" width="220" height="164" /></span>` : ''}
        <span class="pick-main flex-1">
          <span class="pick-title">${H.esc(s.name)}</span>
          <span class="pick-sub">${H.duration(s.duration_minutes)} · ${H.esc(s.category)}${s.badge ? ` · ${H.esc(s.badge)}` : ''}</span>
        </span>
        <span class="pick-price">${H.money(s.price_cents, { cents: false })}</span>
      </button>`).join('');

    H.qsa('[data-service]', mount).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.service = state.services.find((s) => s.id === btn.dataset.service) || null;
        state.time = null;
        H.qsa('[data-service]', mount).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        dom.serviceStepSub.textContent = state.service ? `${state.service.name} · ${H.duration(state.service.duration_minutes)} · ${H.money(state.service.price_cents, { cents: false })}` : 'Pick what you are here for';
        renderServices();
        setStepState();
        updateSummary();
        if (state.stylist) loadSlots();
        H.qs('[data-step="stylist"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /* ── 2 · stylists ────────────────────────────────────────────── */
  function renderStylists() {
    const mount = dom.stylistPicks;
    mount.innerHTML = state.stylists.map((s) => `
      <button class="stylist-pick" type="button" data-stylist="${s.id}" aria-pressed="${state.stylist?.id === s.id}">
        <span class="avatar">${s.avatar_url ? `<img src="${s.avatar_url}" alt="" />` : H.esc(s.avatar_initials || H.initials(s.name))}</span>
        <span class="flex-1" style="min-width:0">
          <span class="stylist-pick-name">${H.esc(s.name)}</span>
          <span class="stylist-pick-role">${H.esc(s.title || '')}</span>
        </span>
        <span class="chip chip-sm chip-gold">Free consult</span>
      </button>`).join('');

    H.qsa('[data-stylist]', mount).forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.stylist = state.stylists.find((s) => s.id === btn.dataset.stylist) || null;
        state.time = null;
        H.qsa('[data-stylist]', mount).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        setStepState();
        updateSummary();
        await loadWeek();
        H.qs('[data-step="time"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /* ── 3 · dates + slots ───────────────────────────────────────── */
  async function loadWeek() {
    if (!state.stylist) return;
    try {
      const { days } = await H.api.get(`/api/stylists/${state.stylist.id}/availability`);
      state.days = days;
      if (!state.date || !days.some((d) => d.date === state.date && d.is_working)) {
        const firstOpen = days.find((d) => d.is_working);
        state.date = firstOpen ? firstOpen.date : days[0].date;
      }
      renderDateRail();
      await loadSlots();
    } catch (err) {
      dom.slotArea.innerHTML = `<p class="slot-note">${H.icon('alert')}${H.esc(err.message)}</p>`;
    }
  }

  function renderDateRail() {
    const mount = dom.dateRail;
    mount.innerHTML = state.days.map((d) => {
      const dt = new Date(`${d.date}T12:00:00`);
      const isToday = d.date === todayISO();
      const isTomorrow = d.date === addDays(todayISO(), 1);
      const tag = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : '';
      return `<button class="date-pill" type="button" data-date="${d.date}" aria-pressed="${state.date === d.date}" ${d.is_working ? '' : 'disabled'}>
        <span class="date-dow">${dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span class="date-day">${dt.getDate()}</span>
        <span class="date-mon">${dt.toLocaleDateString('en-US', { month: 'short' })}</span>
        ${tag ? `<span class="date-tag">${tag}</span>` : ''}
      </button>`;
    }).join('');

    H.qsa('[data-date]', mount).forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.date = btn.dataset.date;
        state.time = null;
        H.qsa('[data-date]', mount).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        await loadSlots();
        updateSummary();
        setStepState();
      });
    });
  }

  function groupSlots(slots) {
    const groups = { Morning: [], Afternoon: [], Evening: [] };
    slots.forEach((s) => {
      const h = Number(s.time.split(':')[0]);
      const key = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      groups[key].push(s);
    });
    return groups;
  }

  async function loadSlots() {
    if (!state.stylist || !state.date) return;
    dom.slotArea.innerHTML = `<div class="slot-grid">${'<div class="skeleton" style="height:42px"></div>'.repeat(8)}</div>`;
    try {
      const query = new URLSearchParams({ stylist_id: state.stylist.id, date: state.date });
      if (state.service) query.set('service_id', state.service.id);
      const data = await H.api.get(`/api/availability?${query}`);
      state.slots = data.slots || [];

      if (data.message && !state.slots.length) {
        dom.slotArea.innerHTML = `<div class="empty" style="padding:24px">${H.icon('calendar')}<p class="body-md">${H.esc(data.message)}</p></div>`;
        return;
      }

      const available = state.slots.filter((s) => s.available);
      if (!available.length) {
        dom.slotArea.innerHTML = `<div class="empty" style="padding:24px">
          ${H.icon('calendar')}
          <p class="body-md">Fully booked on ${H.dateLong(state.date)}. Try another day — or join the waitlist by calling the studio.</p>
          <a class="btn btn-sm btn-outline" href="tel:+15550198234">Call (555) 019-8234</a>
        </div>`;
        return;
      }

      const groups = groupSlots(state.slots);
      dom.slotArea.innerHTML = `
        ${Object.entries(groups).filter(([, list]) => list.length).map(([label, list]) => `
          <div class="slot-group">
            <div class="slot-group-head">${label}</div>
            <div class="slot-grid">
              ${list.map((s) => `<button class="slot" type="button" data-time="${s.time}" aria-pressed="${state.time === s.time}" ${s.available ? '' : 'disabled'} title="${s.available ? `${H.time12(s.time)} – ${H.time12(s.end_time)}` : s.reason === 'too_soon' ? 'Too soon to book online' : 'Already booked'}">${H.time12(s.time).replace(':00', '')}</button>`).join('')}
            </div>
          </div>`).join('')}
        <p class="slot-note mt-md">${H.icon('info')}Times shown for your service length (${H.duration(state.service?.duration_minutes || 45)}). Availability updates live.</p>`;

      H.qsa('[data-time]', dom.slotArea).forEach((btn) => {
        btn.addEventListener('click', () => {
          state.time = btn.dataset.time;
          H.qsa('[data-time]', dom.slotArea).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          updateSummary();
          setStepState();
          H.qs('[data-step="details"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => H.qs('#bk-name')?.focus({ preventScroll: true }), 420);
        });
      });
    } catch (err) {
      dom.slotArea.innerHTML = `<p class="slot-note">${H.icon('alert')}${H.esc(err.message)}</p>`;
    }
  }

  /* ── 4 · submit ──────────────────────────────────────────────── */
  function fieldError(name, message) {
    const node = H.qs(`[data-error-for="${name}"]`);
    if (node) node.textContent = message || '';
    const input = H.qs(`[name="${name}"]`);
    if (input) input.closest('.field')?.classList.toggle('is-invalid', !!message);
  }

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    let valid = true;

    fieldError('name', ''); fieldError('email', '');
    if (!data.name || data.name.trim().length < 2) { fieldError('name', 'Please tell us your name.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(data.email || '')) { fieldError('email', 'Please enter a valid email address.'); valid = false; }
    if (!valid) return;

    if (!state.service || !state.stylist || !state.date || !state.time) {
      H.toast('Please complete each step before confirming.', { type: 'error' });
      return;
    }

    dom.confirmBtn.disabled = true;
    dom.confirmBtn.innerHTML = 'Reserving your chair…';
    try {
      const res = await H.api.post('/api/bookings', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        service_id: state.service.id,
        stylist_id: state.stylist.id,
        date: state.date,
        time: state.time,
        marketing_opt_in: H.qs('#bk-consent').checked,
      });
      showConfirmation(res);
    } catch (err) {
      dom.confirmBtn.disabled = false;
      dom.confirmBtn.innerHTML = 'Confirm appointment';
      if (err.code === 'SLOT_TAKEN') {
        H.toast('That slot was just taken — pick another time.', { type: 'error' });
        await loadSlots();
      } else {
        H.toast(err.message, { type: 'error' });
      }
    }
  }

  function showConfirmation(res) {
    const a = res.appointment || {};
    H.qs('#booking-main').querySelectorAll('[data-step]').forEach((n) => { n.hidden = true; });
    const wrap = H.qs('#confirmation');
    wrap.hidden = false;
    H.qs('#confirm-title').textContent = a.status === 'confirmed' ? 'Your appointment is confirmed' : 'Your request is in';
    H.qs('#confirm-message').textContent = res.message || 'We will confirm by email shortly.';
    H.qs('#confirm-card').innerHTML = `
      <div class="row-between" style="align-items:flex-start">
        <div>
          <p class="confirm-ref">Booking reference</p>
          <p class="title-lg tabular" style="letter-spacing:.08em">${H.esc(a.id ? String(a.id).slice(0, 8).toUpperCase() : '—')}</p>
        </div>
        ${H.statusBadge(a.status || 'pending')}
      </div>
      <hr class="rule mt-md" style="margin-block:16px" />
      <div class="summary-row"><span class="k">${H.icon('scissors')}Service</span><span class="v">${H.esc(a.service || state.service?.name || '')}</span></div>
      <div class="summary-row"><span class="k">${H.icon('user')}Stylist</span><span class="v">${H.esc(a.stylist || state.stylist?.name || '')}</span></div>
      <div class="summary-row"><span class="k">${H.icon('calendar')}When</span><span class="v">${H.dateLong(a.date || state.date)}<br /><span class="dim">${H.time12(a.time || state.time)} – ${H.time12(a.end_time || '')}</span></span></div>
      <div class="summary-row"><span class="k">${H.icon('clock')}Duration</span><span class="v">${H.duration(a.duration_minutes || state.service?.duration_minutes || 45)}</span></div>
      <div class="summary-total"><span class="label">Estimated total</span><span class="value">${H.money((a.price || 0) * 100, { cents: false })}</span></div>
      <p class="body-sm dim mt-md">A confirmation is on its way to ${H.esc(res.client?.email || '')}. Need to change something? Call (555) 019-8234 — free up to 24 hours before.</p>`;
    H.qs('#mobile-sum')?.classList.remove('is-visible');
    H.hydrate(wrap);
    H.toast('Appointment reserved — check your inbox.', { type: 'success' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── boot ────────────────────────────────────────────────────── */
  async function boot() {
    dom.servicePicks = H.qs('#service-picks');
    dom.stylistPicks = H.qs('#stylist-picks');
    dom.dateRail = H.qs('#date-rail');
    dom.slotArea = H.qs('#slot-area');
    dom.sumService = H.qs('#sum-service');
    dom.sumStylist = H.qs('#sum-stylist');
    dom.sumDate = H.qs('#sum-date');
    dom.sumTime = H.qs('#sum-time');
    dom.sumTotal = H.qs('#sum-total');
    dom.sumDuration = H.qs('#sum-duration');
    dom.sumNote = H.qs('#sum-note');
    dom.confirmBtn = H.qs('#confirm-btn');
    dom.serviceStepSub = H.qs('#service-step-sub');

    H.qs('#booking-form').addEventListener('submit', submit);
    H.qs('#m-sum-next').addEventListener('click', () => {
      const target = !state.stylist ? '[data-step="stylist"]' : !state.time ? '[data-step="time"]' : '[data-step="details"]';
      H.qs(target).scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (state.time) setTimeout(() => H.qs('#bk-name')?.focus({ preventScroll: true }), 400);
    });
    H.qs('#date-rail-label').textContent = `Next 7 days · ${H.monthName(todayISO())}`;

    try {
      const [{ services }, { stylists }] = await Promise.all([
        H.api.get('/api/services'),
        H.api.get('/api/stylists'),
      ]);
      state.services = services;
      state.stylists = stylists;

      const params = new URLSearchParams(location.search);
      const slug = params.get('service');
      if (slug) state.service = services.find((s) => s.slug === slug) || null;
      const stylistId = params.get('stylist');
      if (stylistId) state.stylist = stylists.find((s) => s.id === stylistId) || null;

      renderServices();
      renderStylists();

      if (state.stylist) {
        await loadWeek();
        if (state.service) {
          dom.serviceStepSub.textContent = `${state.service.name} · ${H.duration(state.service.duration_minutes)} · ${H.money(state.service.price_cents, { cents: false })}`;
        }
      } else {
        dom.slotArea.innerHTML = `<p class="slot-note">${H.icon('info')}Choose a stylist to see live availability.</p>`;
        dom.dateRail.innerHTML = `<p class="slot-note">Your dates will appear once a stylist is chosen.</p>`;
      }
      setStepState();
      updateSummary();
      H.reveal();
    } catch (err) {
      H.toast(err.message, { type: 'error' });
      dom.servicePicks.innerHTML = `<div class="empty">${H.icon('alert')}<p class="body-md">We could not load the booking tools. Please call the studio on (555) 019-8234.</p></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
