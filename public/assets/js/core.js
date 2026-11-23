/* =====================================================================
   HEARTH — shared front-end core
   icons · api · toasts · numbers · shell behaviour
   ===================================================================== */
(function () {
  'use strict';

  /* ── Icons (24×24, 1.6 stroke, rounded) ─────────────────────── */
  const PATHS = {
    spa: '<path d="M12 21c0-4.5 2.7-7.6 6.5-8.6C18 17 15.5 21 12 21Z"/><path d="M12 21c0-4.5-2.7-7.6-6.5-8.6C6 17 8.5 21 12 21Z"/><path d="M12 12.5c1.6-2.4 1.9-5.6.4-8.5-1.9 1-3 2.9-3.2 5.1"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    phone: '<path d="M6.3 3.5h2.9l1.5 3.7-2 1.3a11 11 0 0 0 5.3 5.3l1.3-2 3.7 1.5v2.9c0 1.2-1 2.2-2.2 2.1A15.6 15.6 0 0 1 4.2 5.7c-.1-1.2.9-2.2 2.1-2.2Z"/>',
    pin: '<path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.6 7.5 8.4 5.6 8.4-5.6"/>',
    send: '<path d="m21 3-9.8 9.8"/><path d="M21 3l-6.4 18-3.4-8.2L3 9.4 21 3Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6"/>',
    users: '<circle cx="9.5" cy="8.5" r="3.3"/><path d="M3.5 20c.6-3.3 3.1-5.2 6-5.2s5.4 1.9 6 5.2"/><path d="M16.4 5.6a3.2 3.2 0 0 1 0 6.2"/><path d="M17.8 14.9c2 .5 3.4 2.2 3.8 4.6"/>',
    scissors: '<circle cx="6.5" cy="6.5" r="2.6"/><circle cx="6.5" cy="17.5" r="2.6"/><path d="M8.6 8.4 19 18M19 6 8.6 15.6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2.2-.9 2.2-2 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.3 0-1 .8-1.8 1.9-1.8H17a4 4 0 0 0 4-4C21 6.2 17.1 3 12 3Z"/><circle cx="8" cy="9.5" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="15.8" cy="9.8" r="1.1"/>',
    leaf: '<path d="M20 4c0 8-5.4 13-11 13H5c0-8 5.4-13 11-13h4Z"/><path d="M4.5 20c1.5-4 4.5-7.4 9-9.5"/>',
    cup: '<path d="M5 8h11v6a4.5 4.5 0 0 1-4.5 4.5H9.5A4.5 4.5 0 0 1 5 14V8Z"/><path d="M16 9.5h1.8a2.7 2.7 0 0 1 0 5.4H16"/><path d="M4 21h13"/>',
    sparkle: '<path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z"/><path d="M18.5 16.2 19.2 18l1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>',
    shield: '<path d="M12 3.5 19.5 6v6c0 4.3-3.1 7.6-7.5 8.9C7.6 19.6 4.5 16.3 4.5 12V6L12 3.5Z"/><path d="m9 12 2.2 2.2 4-4.2"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/>',
    chart: '<path d="M4 20V6"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx="1"/><rect x="13" y="8.5" width="3" height="8.5" rx="1"/>',
    layout: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M9 9.5V20"/>',
    chair: '<path d="M7 4h10a1.5 1.5 0 0 1 1.5 1.5V14H5.5V5.5A1.5 1.5 0 0 1 7 4Z"/><path d="M4 14h16v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14Z"/><path d="M7 18v2.5M17 18v2.5"/>',
    bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2 2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 11a2 2 0 1 1 0 4Z"/>',
    logout: '<path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M10 12h11"/><path d="m18 9 3 3-3 3"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 12a2 2 0 0 0 2 1.8h6A2 2 0 0 0 17 19l1-12"/>',
    edit: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    alert: '<path d="M12 4.5 21 19.5H3L12 4.5Z"/><path d="M12 10v4M12 17h.01"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>',
    facebook: '<path d="M14.5 8.5h2.3V5.2h-2.7c-2.4 0-4 1.6-4 4v2.1H7.5v3.3h2.6V21h3.4v-6.4h2.6l.4-3.3h-3V9.5c0-.6.4-1 1-1Z"/>',
    pinterest: '<circle cx="12" cy="12" r="9"/><path d="M10.5 20c.8-1.4 1.2-2.8 1.5-4.2"/><path d="M9.6 14.4c-.6-1.6-.3-4 1.2-5.4 1.8-1.7 4.7-.7 5.1 1.7.4 2.4-1 4.4-2.6 4.4-1 0-1.8-.8-1.6-1.8"/>',
    quote: '<path d="M9 6c-2.8 0-5 2.3-5 5.2V18h6v-6H6.4c0-1.7 1.2-3 2.6-3V6Z"/><path d="M19 6c-2.8 0-5 2.3-5 5.2V18h6v-6h-3.6c0-1.7 1.2-3 2.6-3V6Z"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z"/><path d="M9.5 20.5v-6h5v6"/>',
    truck: '<path d="M3 7h10v9H3z"/><path d="M13 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M3 6.5h18V10H3z"/><path d="M12 10v10"/><path d="M12 6.5c-2.5 0-4-1-4-2.5S9.5 2 12 6.5Zm0 0c2.5 0 4-1 4-2.5S14.5 2 12 6.5Z"/>',
    chartUp: '<path d="m4 16 5-5 3.5 3.5L20 7"/><path d="M15 7h5v5"/>',
  };

  function icon(name, className = 'icon', extra = '') {
    const path = PATHS[name] || PATHS.sparkle;
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
  }

  /* ── Formatting ─────────────────────────────────────────────── */
  const money = (cents, opts = {}) => {
    const value = (Number(cents) || 0) / 100;
    return value.toLocaleString('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: opts.cents === false ? 0 : 2,
      maximumFractionDigits: opts.cents === false ? 0 : 2,
    });
  };
  const moneyShort = (cents) => {
    const v = (Number(cents) || 0) / 100;
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };
  const duration = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };
  const time12 = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  const parseDate = (iso) => new Date(`${iso}T12:00:00`);
  const dateLong = (iso) => parseDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const dateShort = (iso) => parseDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const monthName = (iso) => parseDate(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = (rating = 5) => {
    const full = Math.round(Number(rating));
    return `<span class="stars" aria-label="${rating} out of 5">${Array.from({ length: 5 }, (_, i) =>
      `<svg viewBox="0 0 24 24" style="opacity:${i < full ? 1 : 0.22}"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/></svg>`
    ).join('')}</span>`;
  };
  const STATUS_LABEL = {
    pending: 'Pending', confirmed: 'Confirmed', in_chair: 'In chair',
    completed: 'Completed', cancelled: 'Cancelled', no_show: 'No show',
  };
  const statusBadge = (status) =>
    `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;

  /* ── API client ─────────────────────────────────────────────── */
  async function request(path, options = {}) {
    const opts = { credentials: 'same-origin', headers: {}, ...options };
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    loadbar(true);
    try {
      const res = await fetch(path, opts);
      const text = await res.text();
      let data = {};
      if (text) { try { data = JSON.parse(text); } catch { data = { error: text }; } }
      if (!res.ok || data.ok === false) {
        const err = new Error(data.error || data.message || `Request failed (${res.status})`);
        err.status = res.status;
        err.code = data.code;
        err.data = data;
        throw err;
      }
      return data;
    } finally {
      loadbar(false);
    }
  }

  const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' }),
  };

  /* ── Load bar ───────────────────────────────────────────────── */
  let bar = null;
  let barCount = 0;
  function loadbar(active) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'load-bar';
      document.body.appendChild(bar);
    }
    barCount = Math.max(0, barCount + (active ? 1 : -1));
    if (barCount > 0) {
      bar.classList.add('is-active');
      bar.style.width = '70%';
    } else {
      bar.style.width = '100%';
      setTimeout(() => {
        bar.classList.remove('is-active');
        bar.style.width = '0';
      }, 260);
    }
  }

  /* ── Toasts ─────────────────────────────────────────────────── */
  function toast(message, { type = 'success', timeout = 4200, detail = '' } = {}) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const glyph = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle';
    el.innerHTML = `${icon(glyph)}<div><div>${esc(message)}</div>${detail ? `<div style="opacity:.72;font-size:.8125rem;margin-top:2px">${esc(detail)}</div>` : ''}</div>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }, timeout);
    return el;
  }

  /* ── Misc helpers ───────────────────────────────────────────── */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);
  const debounce = (fn, ms = 220) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  function reveal(scope = document) {
    const items = qsa('.reveal:not(.is-in)', scope);
    if (!('IntersectionObserver' in window)) {
      items.forEach((i) => i.classList.add('is-in'));
      return;
    }
    // Batch to one paint per frame: fast scrolling (or a fling on mobile) fires
    // many intersection records at once and can otherwise outrun the main thread.
    let queue = [];
    let queued = false;
    const flush = () => {
      queued = false;
      queue.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
      queue = [];
    };
    const io = new IntersectionObserver((entries) => {
      queue.push(...entries);
      if (queued) return;
      queued = true;
      requestAnimationFrame(flush);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((item, i) => {
      if (!item.style.getPropertyValue('--reveal-delay')) item.style.setProperty('--reveal-delay', `${Math.min(i * 60, 320)}ms`);
      io.observe(item);
    });

    // Safety net — a scroll that lands mid-page (anchor, refresh, fling) can
    // leave work above the fold unobserved. Nothing is ever allowed to stay
    // invisible: reveal whatever is still hidden shortly after load.
    window.setTimeout(() => {
      qsa('.reveal:not(.is-in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.6) { el.classList.add('is-in'); io.unobserve(el); }
      });
    }, 700);
  }

  /* ── Static markup hydration: [data-icon] and [data-stars] ──── */
  function hydrate(root = document) {
    qsa('[data-icon]', root).forEach((node) => {
      if (node.dataset.hydrated) return;
      node.dataset.hydrated = '1';
      node.innerHTML = icon(node.dataset.icon);
    });
    qsa('[data-stars]', root).forEach((node) => {
      if (node.dataset.hydrated) return;
      node.dataset.hydrated = '1';
      const n = Number(node.dataset.stars) || 5;
      node.innerHTML = Array.from({ length: n }, () =>
        '<svg style="width:13px;height:13px;fill:currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/></svg>'
      ).join('');
    });
  }

  /* ── Shell: header, drawer, year, studio info ───────────────── */
  function initShell() {
    hydrate();
    const header = qs('.site-header');
    const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    on(window, 'scroll', onScroll, { passive: true });

    const drawer = qs('.drawer');
    const openBtn = qs('[data-drawer-open]');
    const closeBtns = qsa('[data-drawer-close]');
    const setDrawer = (open) => {
      if (!drawer) return;
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    };
    on(openBtn, 'click', () => setDrawer(true));
    closeBtns.forEach((b) => on(b, 'click', () => setDrawer(false)));
    on(document, 'keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

    qsa('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });
    qsa('[data-current-page]').forEach((n) => {
      const page = n.dataset.currentPage;
      qsa('.nav-link, .drawer-link').forEach((link) => {
        if (link.getAttribute('href') === page || link.dataset.page === page) link.setAttribute('aria-current', 'page');
      });
    });

    reveal();
    initAnnouncement();
    initStudioDetails();
  }

  /* Pages without an announcement bar still need the studio's real details. */
  function setCancelNote(text, selector = '[data-studio-cancel-note]') {
    if (!text) return;
    document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
  }

  function setCancelNoteSentence(text) {
    setCancelNote(text, '[data-studio-cancel-note].is-sentence');
  }

  /* The cancellation window is a setting, so the promise copy follows it. */
  function setCancelCopy(studio) {
    const h = studio && studio.cancellation_hours;
    if (!h) return;
    setCancelNote(`free changes up to ${h} hours before`);
    setCancelNoteSentence(`Free changes or cancellation up to ${h} hours before.`);
  }

  function initStudioDetails() {
    if (qs('[data-announcement]')) return;   // initAnnouncement already did it
    api.get('/api/studio').then(({ studio }) => {
      if (!studio) return;
      setPhone(document, studio.phone);
      setAddress(document, studio.address);
      setEmail(document, studio.email);
      setCancelCopy(studio);
    }).catch(() => {});
  }

  /* ── Announcement bar (any page; beats the settings fallback) ─ */
  const ANNOUNCE_KEY = 'lumina.announcement.dismissed';

  /** A dismissal is tied to the message itself, not to "forever". */
  function announcementSeen(text) {
    try { return localStorage.getItem(ANNOUNCE_KEY) === String(text).trim(); } catch { return false; }
  }
  function rememberAnnouncement(text) {
    try { localStorage.setItem(ANNOUNCE_KEY, String(text).trim()); } catch { /* private mode */ }
  }

  /** Phone numbers become a dialable link and a readable label. */
  function setPhone(root, phone) {
    if (!root || !phone) return;
    const dial = String(phone).replace(/[^0-9+]/g, '');
    qsa('[data-studio-phone]', root).forEach((n) => { n.textContent = phone; });
    qsa('[data-studio-phone-link]', root).forEach((n) => { n.href = 'tel:' + dial; });
  }

  /** Address text, honouring the line break the design uses. */
  function setAddress(root, address) {
    if (!address) return;
    const parts = String(address).split(',').map((x) => x.trim()).filter(Boolean);
    qsa('[data-studio-address]', root).forEach((n) => {
      /* a heading spans one line; the list and paragraph forms break after the street */
      const multiline = n.tagName === 'P' || n.tagName === 'LI';
      n.innerHTML = multiline && parts.length > 1
        ? `${esc(parts[0])}<br />${esc(parts.slice(1).join(', '))}`
        : esc(parts.join(', '));
    });
  }

  function setEmail(root, email) {
    if (!email) return;
    qsa('[data-studio-email]', root).forEach((n) => { n.textContent = email; });
    qsa('[data-studio-email-link]', root).forEach((n) => { n.href = 'mailto:' + email; });
  }

  function initAnnouncement() {
    const bar = qs('[data-announcement]');
    api.get('/api/studio').then(({ studio }) => {
      if (!studio) return;
      /* studio details drive every page, not just the bar */
      setPhone(document, studio.phone);
      setAddress(document, studio.address);
      setEmail(document, studio.email);
      setCancelCopy(studio);
      if (!bar || !studio.announcement) return;
      /* already dismissed this exact message — stay quiet */
      if (announcementSeen(studio.announcement)) return;
      const text = qs('[data-announcement-text]', bar);
      if (text) text.textContent = studio.announcement;
      const link = qs('[data-announcement-link]', bar);
      if (link) {
        if (studio.announcement_link_url) {
          link.href = studio.announcement_link_url;
          link.textContent = studio.announcement_link_label || 'Find out more';
          link.hidden = false;
        } else {
          link.hidden = true;
        }
      }
      if (studio.announcement_variant) bar.dataset.variant = studio.announcement_variant;
      bar.hidden = false;

      const close = qs('[data-announcement-close]', bar);
      if (close) {
        close.addEventListener('click', () => {
          rememberAnnouncement(studio.announcement);
          bar.classList.add('is-closing');
          const done = () => { bar.hidden = true; bar.classList.remove('is-closing'); };
          bar.addEventListener('transitionend', done, { once: true });
          setTimeout(done, 320);           // fallback if the transition never fires
          close.blur();
        });
      }
    }).catch(() => {});
  }

  /* ── Newsletter form (any page) ─────────────────────────────── */
  function initSubscribe() {
    qsa('form[data-subscribe]').forEach((form) => {
      on(form, 'submit', async (e) => {
        e.preventDefault();
        const input = qs('input[type="email"]', form);
        const btn = qs('button[type="submit"]', form);
        if (!input.value.includes('@')) { toast('Please enter a valid email address.', { type: 'error' }); return; }
        btn.disabled = true;
        try {
          const r = await api.post('/api/subscribe', {
            email: input.value.trim(),
            source: form.dataset.subscribe || 'footer',
          });
          toast(r.message || 'You are on the list.');
          form.reset();
        } catch (err) {
          toast(err.message, { type: 'error' });
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  /* ── Focus trap for modals/panels ───────────────────────────── */
  function trapFocus(container) {
    const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = [...container.querySelectorAll(selector)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', handler);
    return () => container.removeEventListener('keydown', handler);
  }

  window.Hearth = {
    icon, hydrate, api, toast, money, moneyShort, duration, time12, dateLong, dateShort, monthName,
    initials, esc, stars, statusBadge, STATUS_LABEL, qs, qsa, on, debounce, el, reveal,
    initShell, initSubscribe, trapFocus, loadbar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initShell(); initSubscribe(); });
  } else {
    initShell(); initSubscribe();
  }
})();
