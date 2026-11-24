'use strict';

const express = require('express');
const db = require('../db');
const { wrap, ApiError, clean, normEmail, normPhone, EMAIL_RE } = require('../lib/util');
const { requireAdmin } = require('../lib/auth');
const { getSettings, invalidate, NUMERIC, BOOLEAN } = require('../lib/settings');
const { isValidISODate, isValidTime, toMinutes, fromMinutes, salonDate, salonTime, addDays, weekdayIndex, prettyDate } = require('../lib/time');
const { STATUSES } = require('../lib/schedule');
const mailer = require('../lib/mailer');
const storage = require('../lib/storage');
const { studioContext, appointmentContext } = require('../lib/mailContext');

const router = express.Router();
router.use(requireAdmin);

const APPT_SELECT =
  'id,reference,client_id,service_id,stylist_id,appointment_date,time,end_time,duration_minutes,price_cents,status,source,notes,checked_in_at,completed_at,cancelled_at,created_at,' +
  'clients(id,name,email,phone),services(id,name,category,duration_minutes),stylists(id,name,title,avatar_initials)';

/* ─────────────────────────── Overview ─────────────────────────── */

router.get('/overview', wrap(async (_req, res) => {
  const today = salonDate();
  const now = salonTime();
  const tomorrow = addDays(today, 1);

  /* one round-trip window: everything the dashboard needs, in parallel */
  const [
    { data: appts }, { data: clients }, { data: stylists }, { data: messages },
    { data: lastWeek }, { data: recentActivity }, { data: availabilityRows }, { data: tomorrowRows },
  ] = await Promise.all([
    db.from('appointments').select(APPT_SELECT).eq('appointment_date', today).order('time'),
    db.from('clients').select('id,name,email,phone,visit_count,total_spent_cents,last_visit_date,created_at').order('name'),
    db.from('stylists').select('id,name,title,avatar_initials,is_active').eq('is_active', true).order('sort_order'),
    db.from('messages').select('id,name,email,subject,message,status,created_at').eq('status', 'new').order('created_at', { ascending: false }).limit(5),
    db.from('appointments').select('price_cents,status').eq('appointment_date', addDays(today, -7)),
    db.from('activity_log').select('id,actor,action,detail,created_at').order('created_at', { ascending: false }).limit(8),
    db.from('stylist_availability').select('*').eq('weekday', weekdayIndex(today)),
    db.from('appointments').select('id').eq('appointment_date', tomorrow),
  ]);

  const list = appts || [];
  const { getSettings: gs } = require('../lib/settings');
  const settings = await gs();

  const revenue = list.filter((a) => !['cancelled', 'no_show'].includes(a.status)).reduce((s, a) => s + a.price_cents, 0);
  const active = list.filter((a) => ['confirmed', 'in_chair'].includes(a.status));
  const inChair = list.filter((a) => a.status === 'in_chair').length;

  /* open slots today, across every active stylist */
  const { buildSlots } = require('../lib/schedule');
  const openSlots = [];
  for (const stylist of stylists || []) {
    const availability = availabilityRows.find((r) => r.stylist_id === stylist.id);
    const result = buildSlots({
      appointments: list.filter((a) => a.stylist_id === stylist.id),
      availability,
      settings,
      duration: 30,
      date: today,
      nowDate: today,
      nowTime: now,
    });
    for (const slot of result.slots.filter((s) => s.available)) {
      openSlots.push({ time: slot.time, stylist: stylist.name });
    }
  }
  openSlots.sort((a, b) => a.time.localeCompare(b.time));

  /* last week's same weekday for the comparison chip */
  const lastRevenue = (lastWeek || [])
    .filter((a) => !['cancelled', 'no_show'].includes(a.status))
    .reduce((s, a) => s + a.price_cents, 0);

  res.json({
    ok: true,
    date: today,
    prettyDate: prettyDate(today),
    studio: { address: settings.studio_address, phone: settings.studio_phone },
    stats: {
      today_bookings: list.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length,
      pending_requests: list.filter((a) => a.status === 'pending').length,
      in_chair: inChair,
      confirmed: list.filter((a) => a.status === 'confirmed').length,
      revenue_cents: revenue,
      last_week_revenue_cents: lastRevenue,
      revenue_delta_pct: lastRevenue ? Math.round(((revenue - lastRevenue) / lastRevenue) * 100) : null,
      open_slots: openSlots.length,
      next_open: openSlots[0] ? openSlots[0].time : null,
      clients_total: (clients || []).length,
      active_chairs: Math.max(inChair, 0),
      chair_capacity: (stylists || []).length,
    },
    appointments: list,
    stylists: stylists || [],
    open_slots: openSlots.slice(0, 6),
    clients: (clients || []).slice(0, 12),
    messages: messages || [],
    activity: recentActivity || [],
    tomorrow_count: (tomorrowRows || []).length,
  });
}));

/* ─────────────── Emailing clients about their appointment ─────────── */

async function emailClientAbout(appointmentRow, kind) {
  try {
    if (!mailer.isConfigured()) return;
    const client = appointmentRow.clients;
    if (!client || !client.email) return;
    const settings = await getSettings();
    const studio = await studioContext(settings);
    const ctx = appointmentContext({
      appointment: appointmentRow,
      client,
      service: appointmentRow.services || { id: null, name: 'Appointment', duration_minutes: appointmentRow.duration_minutes, price_cents: appointmentRow.price_cents },
      stylist: appointmentRow.stylists || { id: null, name: 'the studio' },
    });
    await mailer.sendBookingStatus({
      client: ctx.client,
      appointment: ctx.appointment,
      service: ctx.service,
      stylist: ctx.stylist,
      studio,
      kind,
    });
  } catch (err) {
    console.warn('[admin] client email failed:', err.message);
  }
}

/* ─────────────────────────── Appointments ─────────────────────────── */

router.get('/appointments', wrap(async (req, res) => {
  const date = isValidISODate(req.query.date) ? req.query.date : salonDate();
  const status = clean(req.query.status, 20);
  const stylist = clean(req.query.stylist_id, 40);

  let q = db.from('appointments').select(APPT_SELECT).eq('appointment_date', date).order('time');
  if (status && status !== 'all') q = q.eq('status', status);
  if (stylist && stylist !== 'all') q = q.eq('stylist_id', stylist);

  const [{ data }, { data: stylists }] = await Promise.all([
    q,
    db.from('stylists').select('id,name,title,avatar_initials').eq('is_active', true).order('sort_order'),
  ]);

  const counts = {};
  for (const s of STATUSES) counts[s] = 0;
  const { data: all } = await db.from('appointments').select('status').eq('appointment_date', date);
  for (const row of all || []) counts[row.status] = (counts[row.status] || 0) + 1;

  res.json({ ok: true, date, prettyDate: prettyDate(date), appointments: data || [], stylists: stylists || [], counts, total: (all || []).length });
}));

router.post('/appointments', wrap(async (req, res) => {
  const b = req.body || {};
  if (!isValidISODate(b.appointment_date) || !isValidTime(b.time)) throw new ApiError(400, 'Choose a valid date and time.', 'VALIDATION');
  if (!b.service_id || !b.stylist_id) throw new ApiError(400, 'Choose a service and stylist.', 'VALIDATION');

  const { data: service } = db ? await db.from('services').select('*').eq('id', b.service_id).maybeSingle() : { data: null };
  if (!service) throw new ApiError(404, 'Service not found.');

  let clientId = b.client_id || null;
  if (!clientId) {
    if (!clean(b.client_name)) throw new ApiError(400, 'Add a client name.', 'VALIDATION');
    if (b.client_email && !EMAIL_RE.test(normEmail(b.client_email))) throw new ApiError(400, 'That email looks incorrect.', 'VALIDATION');
    const email = normEmail(b.client_email) || `walkin+${Date.now()}@luminasalon.local`;
    const { data: existing } = await db.from('clients').select('id').eq('email', email).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created } = await db.from('clients').insert({
        name: clean(b.client_name, 120),
        email,
        phone: normPhone(b.client_phone) || null,
        visit_count: 0,
        total_spent_cents: 0,
      }).select('id').single();
      clientId = created.id;
    }
  }

  const end = toMinutes(b.time) + service.duration_minutes;
  const { data: clash } = await db
    .from('appointments')
    .select('id,time,end_time,status')
    .eq('stylist_id', b.stylist_id)
    .eq('appointment_date', b.appointment_date);

  const blocking = ['pending', 'confirmed', 'in_chair', 'completed'];
  const conflict = (clash || []).some(
    (a) => blocking.includes(a.status) && toMinutes(b.time) < toMinutes(a.end_time) && toMinutes(a.time) < end
  );
  if (conflict) throw new ApiError(409, 'That stylist already has a booking in that window.', 'SLOT_TAKEN');

  const { data } = await db.from('appointments').insert({
    client_id: clientId,
    stylist_id: b.stylist_id,
    service_id: service.id,
    appointment_date: b.appointment_date,
    time: b.time,
    end_time: fromMinutes(end),
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
    status: STATUSES.includes(b.status) ? b.status : 'confirmed',
    source: b.source || 'walk_in',
    notes: clean(b.notes, 1000) || null,
  }).select(APPT_SELECT).single();

  await log(req.user, 'appointment_created', `${service.name} · ${b.appointment_date} ${b.time}`);
  res.status(201).json({ ok: true, appointment: data });
}));

router.patch('/appointments/:id/status', wrap(async (req, res) => {
  const status = clean((req.body || {}).status, 20);
  if (!STATUSES.includes(status)) throw new ApiError(400, 'Unknown status.', 'VALIDATION');

  const { data: current } = await db.from('appointments').select('*').eq('id', req.params.id).maybeSingle();
  if (!current) throw new ApiError(404, 'Appointment not found.');

  const patch = { status, status_changed_at: new Date().toISOString() };
  if (status === 'in_chair') patch.checked_in_at = new Date().toISOString();
  if (status === 'completed') patch.completed_at = new Date().toISOString();
  if (status === 'cancelled') patch.cancelled_at = new Date().toISOString();

  const { data } = await db.from('appointments').update(patch).eq('id', current.id).select(APPT_SELECT).single();

  /* completing a visit rolls up the client's lifetime value */
  if (status === 'completed') {
    const { data: client } = await db.from('clients').select('visit_count,total_spent_cents').eq('id', current.client_id).maybeSingle();
    if (client) {
      await db.from('clients').update({
        visit_count: (client.visit_count || 0) + 1,
        total_spent_cents: (client.total_spent_cents || 0) + current.price_cents,
        last_visit_date: current.appointment_date,
      }).eq('id', current.client_id);
    }
  }

  await log(req.user, `appointment_${status}`, data.clients ? `${data.clients.name} · ${data.time}` : data.reference);

  if (!(req.body || {}).silent) {
    if (status === 'confirmed') await emailClientAbout(data, 'confirmed');
    if (status === 'cancelled') await emailClientAbout(data, 'cancelled');
  }
  res.json({ ok: true, appointment: data });
}));

router.patch('/appointments/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const key of ['appointment_date', 'time']) if (b[key]) patch[key] = b[key];
  for (const key of ['stylist_id', 'service_id', 'notes']) if (key in b) patch[key] = b[key] || null;

  if (patch.service_id) {
    const { data: service } = await db.from('services').select('duration_minutes,price_cents').eq('id', patch.service_id).maybeSingle();
    if (service) {
      patch.duration_minutes = service.duration_minutes;
      patch.price_cents = service.price_cents;
    }
  }
  const { data: current } = await db.from('appointments').select('*').eq('id', req.params.id).maybeSingle();
  if (!current) throw new ApiError(404, 'Appointment not found.');
  const start = patch.time || current.time;
  const duration = patch.duration_minutes || current.duration_minutes;
  patch.end_time = fromMinutes(toMinutes(start) + duration);

  const { data } = await db.from('appointments').update(patch).eq('id', current.id).select(APPT_SELECT).single();
  await log(req.user, 'appointment_updated', data.clients ? data.clients.name : data.reference);

  const moved = (patch.appointment_date && patch.appointment_date !== current.appointment_date)
    || (patch.time && patch.time !== current.time);
  if (moved && !(req.body || {}).silent) await emailClientAbout(data, 'rescheduled');
  res.json({ ok: true, appointment: data });
}));

router.delete('/appointments/:id', wrap(async (req, res) => {
  await db.from('appointments').delete().eq('id', req.params.id);
  await log(req.user, 'appointment_deleted', req.params.id);
  res.json({ ok: true });
}));

/* ─────────────────────────── Clients & formulas ─────────────────────────── */

router.get('/clients', wrap(async (req, res) => {
  const search = clean(req.query.search, 80).toLowerCase();
  const { data } = await db
    .from('clients')
    .select('id,name,email,phone,notes,visit_count,total_spent_cents,last_visit_date,created_at')
    .order('name');

  let clients = data || [];
  if (search) {
    clients = clients.filter((c) =>
      [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(search))
    );
  }

  const { data: appts } = await db
    .from('appointments')
    .select('id,client_id,appointment_date,time,status,price_cents,services(name),stylists(name)')
    .order('appointment_date', { ascending: false })
    .limit(300);

  const next = {};
  const today = salonDate();
  for (const a of (appts || []).filter((x) => x.appointment_date >= today && ['pending', 'confirmed'].includes(x.status)).reverse()) {
    next[a.client_id] = a;
  }
  const last = {};
  for (const a of (appts || []).filter((x) => x.appointment_date < today)) {
    if (!last[a.client_id]) last[a.client_id] = a;
  }

  res.json({
    ok: true,
    clients: clients.map((c) => ({
      ...c,
      next_appointment: next[c.id] || null,
      last_appointment: last[c.id] || null,
      average_spend_cents: c.visit_count ? Math.round(c.total_spent_cents / c.visit_count) : 0,
    })),
    stats: {
      total: clients.length,
      returning: clients.filter((c) => c.visit_count > 1).length,
      lifetime_cents: clients.reduce((s, c) => s + (c.total_spent_cents || 0), 0),
      with_allergies: 0,
    },
  });
}));

router.get('/clients/:id', wrap(async (req, res) => {
  const { data: client } = await db.from('clients').select('*').eq('id', req.params.id).maybeSingle();
  if (!client) throw new ApiError(404, 'Client not found.');

  const [{ data: history }, { data: formulas }] = await Promise.all([
    db.from('appointments').select(APPT_SELECT).eq('client_id', client.id).order('appointment_date', { ascending: false }),
    db.from('client_formulas').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
  ]);

  res.json({ ok: true, client, history: history || [], formulas: formulas || [] });
}));

router.post('/clients', wrap(async (req, res) => {
  const b = req.body || {};
  if (!clean(b.name)) throw new ApiError(400, 'A name is required.', 'VALIDATION');
  const email = normEmail(b.email) || `walkin+${Date.now()}@luminasalon.local`;
  if (b.email && !EMAIL_RE.test(email)) throw new ApiError(400, 'That email looks incorrect.', 'VALIDATION');

  const { data: existing } = await db.from('clients').select('id').eq('email', email).maybeSingle();
  if (existing) throw new ApiError(409, 'A client with that email already exists.', 'DUPLICATE');

  const { data } = await db.from('clients').insert({
    name: clean(b.name, 120),
    email,
    phone: normPhone(b.phone) || null,
    notes: clean(b.notes, 2000) || null,
    visit_count: 0,
    total_spent_cents: 0,
  }).select('*').single();

  /* a client added by hand can join the letters list, if the studio says so */
  if (b.subscribe && !email.endsWith('@luminasalon.local') && EMAIL_RE.test(email)) {
    const { data: onList } = await db.from('subscribers').select('id,status').eq('email', email).maybeSingle();
    if (!onList) await db.from('subscribers').insert({ email, name: data.name, source: 'studio', status: 'active' }).then(() => {}).catch(() => {});
    else if (onList.status !== 'active') {
      await db.from('subscribers').update({ status: 'active', unsubscribed_at: null }).eq('id', onList.id).then(() => {}).catch(() => {});
    }
  }

  await log(req.user, 'client_created', data.name);
  res.status(201).json({ ok: true, client: data });
}));

router.patch('/clients/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const key of ['name', 'phone', 'notes', 'allergies']) if (key in b) patch[key] = clean(b[key], 2000) || null;
  if ('email' in b) {
    if (!EMAIL_RE.test(normEmail(b.email))) throw new ApiError(400, 'That email looks incorrect.', 'VALIDATION');
    patch.email = normEmail(b.email);
  }
  const { data } = await db.from('clients').update(patch).eq('id', req.params.id).select('*').single();
  res.json({ ok: true, client: data });
}));

router.post('/clients/:id/formulas', wrap(async (req, res) => {
  const b = req.body || {};
  if (!clean(b.formula)) throw new ApiError(400, 'Add the colour formula.', 'VALIDATION');
  const { data } = await db.from('client_formulas').insert({
    client_id: req.params.id,
    formula: clean(b.formula, 600),
    developer: clean(b.developer, 120) || null,
    processing_minutes: Number(b.processing_minutes) || null,
    stylist_id: b.stylist_id || null,
    notes: clean(b.notes, 1000) || null,
    created_by: req.user.name,
  }).select('*').single();
  res.status(201).json({ ok: true, formula: data });
}));

router.delete('/formulas/:id', wrap(async (req, res) => {
  await db.from('client_formulas').delete().eq('id', req.params.id);
  res.json({ ok: true });
}));

/* ─────────────────────────── Services & pricing ─────────────────────────── */

router.get('/services', wrap(async (_req, res) => {
  const { data } = await db.from('services').select('*').order('sort_order');
  const [{ count: bookingsToday }] = [{ count: 0 }];
  res.json({ ok: true, services: data || [], counts: { bookingsToday } });
}));

router.post('/services', wrap(async (req, res) => {
  const b = req.body || {};
  if (!clean(b.name)) throw new ApiError(400, 'A service name is required.', 'VALIDATION');
  const slug = slugify(b.name);
  const { data } = await db.from('services').insert({
    name: clean(b.name, 120),
    slug,
    category: clean(b.category, 40) || 'Haircuts',
    description: clean(b.description, 600) || null,
    duration_minutes: Number(b.duration_minutes) || 45,
    price_cents: Math.round(Number(b.price_cents) || 0),
    badge: clean(b.badge, 30) || null,
    image_url: clean(b.image_url, 300) || null,
    is_featured: !!b.is_featured,
    is_active: b.is_active === undefined ? true : !!b.is_active,
    sort_order: Number(b.sort_order) || 100,
  }).select('*').single();
  await log(req.user, 'service_created', data.name);
  res.status(201).json({ ok: true, service: data });
}));

router.patch('/services/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('name' in b) { patch.name = clean(b.name, 120); patch.slug = slugify(b.name); }
  if ('category' in b) patch.category = clean(b.category, 40);
  if ('description' in b) patch.description = clean(b.description, 600) || null;
  if ('duration_minutes' in b) patch.duration_minutes = Number(b.duration_minutes) || 45;
  if ('price_cents' in b) patch.price_cents = Math.round(Number(b.price_cents) || 0);
  if ('badge' in b) patch.badge = clean(b.badge, 30) || null;
  if ('image_url' in b) patch.image_url = clean(b.image_url, 300) || null;
  if ('is_featured' in b) patch.is_featured = !!b.is_featured;
  if ('is_active' in b) patch.is_active = !!b.is_active;
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 100;

  const { data } = await db.from('services').update(patch).eq('id', req.params.id).select('*').single();
  await log(req.user, 'service_updated', data.name);
  res.json({ ok: true, service: data });
}));

router.delete('/services/:id', wrap(async (req, res) => {
  await db.from('services').update({ is_active: false }).eq('id', req.params.id);
  res.json({ ok: true, message: 'Service archived — existing bookings keep their details.' });
}));

/* ─────────────────────────── Availability ─────────────────────────── */

/* ─────────────────────────── The team ─────────────────────────── */

/** Deactivate rather than delete: their history must stay intact. */
router.get('/stylists', wrap(async (_req, res) => {
  const { data } = await db
    .from('stylists')
    .select('id,name,slug,title,bio,specialties,avatar_url,avatar_initials,rating,is_active,sort_order')
    .order('sort_order');
  res.json({ ok: true, stylists: data || [] });
}));

function slugFor(name, existing = []) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'stylist';
  let slug = base;
  let n = 2;
  while (existing.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}

function nameInitials(name) {
  return String(name || '')
    .trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0] || '').join('').toUpperCase() || 'LS';
}

function teamFields(body) {
  const b = body || {};
  const patch = {};
  if ('name' in b) patch.name = clean(b.name, 120);
  if ('title' in b) patch.title = clean(b.title, 120) || null;
  if ('bio' in b) patch.bio = clean(b.bio, 1200) || null;
  if ('specialties' in b) {
    const list = Array.isArray(b.specialties) ? b.specialties : String(b.specialties || '').split(',');
    patch.specialties = list.map((x) => clean(x, 40)).filter(Boolean).slice(0, 6);
  }
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if ('is_active' in b) patch.is_active = !!b.is_active;
  return patch;
}

router.post('/stylists', wrap(async (req, res) => {
  const b = req.body || {};
  const patch = teamFields(b);
  if (!patch.name) throw new ApiError(400, 'A name is required.', 'VALIDATION');

  const { data: all } = await db.from('stylists').select('slug,sort_order');
  const maxOrder = Math.max(0, ...(all || []).map((x) => x.sort_order || 0));

  const { data } = await db
    .from('stylists')
    .insert({
      ...patch,
      slug: slugFor(patch.name, (all || []).map((x) => x.slug)),
      avatar_initials: nameInitials(patch.name),
      is_active: patch.is_active !== false,
      sort_order: patch.sort_order || maxOrder + 10,
    })
    .select('*')
    .single();

  /* a new chair with no hours would never show a bookable slot */
  const DAYS = [1, 2, 3, 4, 5]; // Tue–Sat, the studio's week
  await db.from('stylist_availability').insert(
    DAYS.map((weekday) => ({
      stylist_id: data.id,
      weekday,
      is_working: true,
      start_time: '09:00',
      end_time: '19:00',
      break_start: '13:00',
      break_end: '13:30',
    }))
  ).then(() => {}).catch(() => {});

  await log(req.user, 'stylist_added', data.name);
  res.status(201).json({
    ok: true,
    stylist: data,
    message: `${data.name} joined the team. Their first week is Tue–Sat, 9am–7pm — adjust it in Working hours.`,
  });
}));

router.patch('/stylists/:id', wrap(async (req, res) => {
  const patch = teamFields(req.body);
  if ('name' in patch && !patch.name) throw new ApiError(400, 'A name is required.', 'VALIDATION');
  if (patch.name) patch.avatar_initials = nameInitials(patch.name);

  const { data } = await db.from('stylists').update(patch).eq('id', req.params.id).select('*').single();
  await log(req.user, 'stylist_updated', data.name);
  res.json({ ok: true, stylist: data });
}));

/** Portrait upload — same storage bucket as service photos. */
router.post('/stylists/:id/photo', wrap(async (req, res) => {
  const dataUrl = (req.body || {}).dataUrl;
  const { data: stylist } = await db.from('stylists').select('id,name').eq('id', req.params.id).maybeSingle();
  if (!stylist) throw new ApiError(404, 'That stylist is no longer here.');

  const upload = await storage.uploadDataUrl(dataUrl, `stylist-${stylist.name}`);
  if (!upload.ok) throw new ApiError(400, upload.error, 'UPLOAD_FAILED');

  const { data } = await db.from('stylists').update({ avatar_url: upload.url }).eq('id', stylist.id).select('*').single();
  await log(req.user, 'stylist_photo_updated', `${stylist.name} → ${upload.path}`);
  res.json({ ok: true, stylist: data, url: upload.url, message: 'Portrait updated — it shows on the homepage and the booking page.' });
}));

/** Remove a portrait and fall back to initials. */
router.delete('/stylists/:id/photo', wrap(async (req, res) => {
  const { data } = await db.from('stylists').update({ avatar_url: null }).eq('id', req.params.id).select('*').single();
  res.json({ ok: true, stylist: data });
}));

router.get('/availability', wrap(async (_req, res) => {
  const [{ data: stylists }, { data: rows }] = await Promise.all([
    db.from('stylists').select('id,name,title,avatar_initials,is_active').order('sort_order'),
    db.from('stylist_availability').select('*').order('weekday'),
  ]);
  res.json({ ok: true, stylists: stylists || [], availability: rows || [] });
}));

router.put('/availability', wrap(async (req, res) => {
  const { stylist_id: stylistId, rows } = req.body || {};
  if (!stylistId || !Array.isArray(rows)) throw new ApiError(400, 'Send stylist_id and rows.', 'VALIDATION');

  for (const row of rows) {
    const patch = {
      is_working: !!row.is_working,
      start_time: isValidTime(row.start_time) ? row.start_time : '09:00',
      end_time: isValidTime(row.end_time) ? row.end_time : '19:00',
      break_start: isValidTime(row.break_start) ? row.break_start : null,
      break_end: isValidTime(row.break_end) ? row.break_end : null,
    };
    const { data: existing } = await db
      .from('stylist_availability')
      .select('id')
      .eq('stylist_id', stylistId)
      .eq('weekday', Number(row.weekday))
      .maybeSingle();
    if (existing) await db.from('stylist_availability').update(patch).eq('id', existing.id);
    else await db.from('stylist_availability').insert({ stylist_id: stylistId, weekday: Number(row.weekday), ...patch });
  }
  await log(req.user, 'availability_updated', `${rows.length} days`);
  res.json({ ok: true, message: 'Working hours saved.' });
}));

/* ─────────────────────────── Service photos ─────────────────────────── */

/** Upload a replacement photo for a service; returns the public URL. */
router.post('/services/:id/photo', wrap(async (req, res) => {
  const { data: service } = await db.from('services').select('id,name,image_url').eq('id', req.params.id).maybeSingle();
  if (!service) throw new ApiError(404, 'Service not found.');
  const dataUrl = (req.body || {}).data_url;
  if (!dataUrl) throw new ApiError(400, 'No image was sent.');

  const upload = await storage.uploadDataUrl(dataUrl, service.name);
  if (!upload.ok) throw new ApiError(400, upload.error, 'UPLOAD_FAILED');

  const { data } = await db
    .from('services')
    .update({ image_url: upload.url })
    .eq('id', service.id)
    .select('*')
    .single();
  await log(req.user, 'service_photo_updated', `${service.name} → ${upload.path}`);
  res.json({ ok: true, service: data, url: upload.url, message: 'Photo updated — the website picks it up immediately.' });
}));

/** Remove a service photo (falls back to the typographic tile). */
router.delete('/services/:id/photo', wrap(async (req, res) => {
  const { data } = await db.from('services').update({ image_url: null }).eq('id', req.params.id).select('*').single();
  await log(req.user, 'service_photo_removed', data.name);
  res.json({ ok: true, service: data });
}));

/* ─────────────────────────── Email ─────────────────────────── */

router.get('/email/status', wrap(async (_req, res) => {
  const c = mailer.config();
  const configured = mailer.isConfigured();
  res.json({
    ok: true,
    email: {
      configured,
      host: configured ? c.host : null,
      port: configured ? c.port : null,
      user: configured ? c.user : null,
      from: configured ? `${c.fromName} <${c.fromEmail}>` : null,
      notify: configured ? c.notify : null,
    },
  });
}));

router.post('/email/test', wrap(async (req, res) => {
  const to = clean((req.body || {}).to, 160) || req.user.email;
  const check = await mailer.verify();
  if (!check.ok) throw new ApiError(400, `SMTP could not connect: ${check.error}`, 'SMTP_ERROR');
  const settings = await getSettings(true);
  const studio = await studioContext(settings);
  const result = await mailer.send({
    to,
    subject: 'Lumina Salon · your email system is live',
    template: 'announcement',
    replyTo: studio.email,
    data: {
      name: studio.name, address: studio.address, phone: studio.phone, email: studio.email,
      preheader: 'A test from your studio admin.',
      headline: 'Your email system is working',
      intro: `This is a test message from the ${studio.name} admin — sent through <strong>${clean(mailer.config().host, 60)}</strong>.`,
      body: 'From now on, clients receive a beautifully typeset confirmation the moment they book, and you get a quiet alert in the studio inbox.',
      highlights: ['Booking receipts go out automatically', 'You are notified of each new request', 'Replies land straight in your Gmail'],
      buttonLabel: 'Open the studio admin',
      buttonUrl: `${studio.url}/admin`,
    },
  });
  if (!result.ok) throw new ApiError(502, `Send failed: ${result.error}`, 'SMTP_ERROR');
  res.json({ ok: true, message: `Test email sent to ${to}.`, id: result.id });
}));

/* ─────────────────────────── Settings ─────────────────────────── */

router.get('/settings', wrap(async (_req, res) => {
  res.json({ ok: true, settings: await getSettings(true) });
}));

router.put('/settings', wrap(async (req, res) => {
  const patch = req.body || {};
  const { DEFAULTS } = require('../lib/settings');

  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS)) continue;
    const row = { key, value: String(value), updated_at: new Date().toISOString() };
    const { data: existing } = await db.from('settings').select('key').eq('key', key).maybeSingle();
    if (existing) await db.from('settings').update({ value: row.value, updated_at: row.updated_at }).eq('key', key);
    else await db.from('settings').insert(row);
  }
  invalidate();
  await log(req.user, 'settings_updated', Object.keys(patch).join(', '));
  res.json({ ok: true, settings: await getSettings(true) });
}));

/* ─────────────────────────── Announcements ─────────────────────────── */

router.get('/announcements', wrap(async (_req, res) => {
  const { data } = await db.from('announcements').select('*').order('created_at', { ascending: false });
  res.json({ ok: true, announcements: data || [] });
}));

function announcementFrom(body = {}) {
  const b = body || {};
  const starts = clean(b.starts_at, 40) || null;
  const ends = clean(b.ends_at, 40) || null;
  return {
    title: clean(b.title, 120) || 'Studio announcement',
    message: clean(b.message, 400) || null,
    link_label: clean(b.link_label, 60) || null,
    link_url: clean(b.link_url, 300) || null,
    variant: ['info', 'gold', 'plum', 'urgent'].includes(b.variant) ? b.variant : 'info',
    starts_at: starts,
    ends_at: ends,
    is_active: b.is_active === undefined ? true : !!b.is_active,
    updated_at: new Date().toISOString(),
  };
}

router.post('/announcements', wrap(async (req, res) => {
  const patch = announcementFrom(req.body);
  if (!patch.message) throw new ApiError(400, 'Write the announcement text first.');
  if (patch.starts_at && patch.ends_at && patch.ends_at < patch.starts_at) {
    throw new ApiError(400, 'The end date must come after the start date.');
  }
  const { data } = await db.from('announcements').insert(patch).select('*').single();
  await log(req.user, 'announcement_created', data.title);
  res.status(201).json({ ok: true, announcement: data });
}));

router.patch('/announcements/:id', wrap(async (req, res) => {
  const patch = announcementFrom(req.body);
  if (patch.starts_at && patch.ends_at && patch.ends_at < patch.starts_at) {
    throw new ApiError(400, 'The end date must come after the start date.');
  }
  const { data } = await db.from('announcements').update(patch).eq('id', req.params.id).select('*').single();
  await log(req.user, 'announcement_updated', data.title);
  res.json({ ok: true, announcement: data });
}));

router.delete('/announcements/:id', wrap(async (req, res) => {
  await db.from('announcements').delete().eq('id', req.params.id);
  await log(req.user, 'announcement_deleted', req.params.id);
  res.json({ ok: true });
}));

/**
 * Email one announcement to the studio letters list.
 *
 * Deliberately NOT every client in the diary: a booking is a transaction, not
 * consent to marketing. Only `subscribers` with status 'active' are emailed,
 * and every message carries a one-click unsubscribe link.
 */
router.post('/announcements/:id/send', wrap(async (req, res) => {
  const { data: announcement } = await db.from('announcements').select('*').eq('id', req.params.id).maybeSingle();
  if (!announcement) throw new ApiError(404, 'Announcement not found.');
  if (!mailer.isConfigured()) throw new ApiError(400, 'Email is not configured yet.', 'SMTP_ERROR');

  const { data: subs } = await db
    .from('subscribers')
    .select('id,email,name,status,source,token')
    .eq('status', 'active')
    .order('created_at');

  let recipients = (subs || []).filter((s) => s && s.email);
  const body = req.body || {};

  /* a rehearsal aimed at one address: send nothing to anybody else */
  if (body.to) {
    const only = String(body.to).trim().toLowerCase();
    recipients = recipients.filter((s) => s.email.toLowerCase() === only);
    if (!recipients.length) throw new ApiError(400, `${only} is not on the letters list.`);
  }

  if (body.dry_run) {
    return res.json({
      ok: true,
      dry_run: true,
      count: recipients.length,
      recipients: recipients.map((s) => s.email),
    });
  }
  if (!recipients.length) {
    throw new ApiError(400, 'Nobody has joined the studio letters list yet — there is no one to email.');
  }

  const settings = await getSettings(true);
  const studio = await studioContext(settings);

  const sendOne = async (sub) => {
    const unsubUrl = `${studio.url}/unsubscribe?token=${encodeURIComponent(sub.token)}`;
    const result = await mailer.send({
      to: sub.email,
      subject: announcement.title,
      template: 'announcement',
      replyTo: studio.email,
      /* one-click unsubscribe in the client's own chrome, too */
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      data: {
        name: studio.name, address: studio.address, phone: studio.phone, email: studio.email,
        preheader: announcement.message || announcement.title,
        headline: announcement.title,
        intro: `Hello ${String(sub.name || '').split(' ')[0] || 'there'},`,
        body: announcement.message,
        buttonLabel: announcement.link_label || 'Book a chair',
        buttonUrl: announcement.link_url || `${studio.url}/booking`,
        unsubscribeUrl: unsubUrl,
      },
    });
    if (result.ok) {
      await db.from('subscribers').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id).then(() => {}).catch(() => {});
      return { ok: true, email: sub.email };
    }
    return { ok: false, email: sub.email, error: result.error };
  };

  /* Gmail throttles a single connection, so send in small parallel waves
     instead of one-at-a-time — a 100-person list takes seconds, not minutes. */
  const WAVE = 4;
  let sent = 0; const failures = [];
  for (let i = 0; i < recipients.length; i += WAVE) {
    const batch = recipients.slice(i, i + WAVE);
    const results = await Promise.all(batch.map(sendOne));
    for (const r of results) {
      if (r.ok) sent += 1;
      else failures.push({ email: r.email, error: r.error });
    }
  }
  const wasTest = !!(body.to);
  if (!wasTest) {
    await db.from('announcements').update({ sent_at: new Date().toISOString(), sent_count: sent }).eq('id', announcement.id);
  }
  await log(req.user, wasTest ? 'announcement_test_sent' : 'announcement_sent', `${announcement.title} → ${sent} subscriber${sent === 1 ? '' : 's'}`);
  res.json({ ok: true, sent, failed: failures.length, failures: failures.slice(0, 5) });
}));

/* ─────────────────────────── Studio letters list ─────────────────────────── */

router.get('/subscribers', wrap(async (req, res) => {
  const status = clean(req.query.status, 20);
  let q = db.from('subscribers').select('id,email,name,status,source,created_at,unsubscribed_at,last_sent_at').order('created_at', { ascending: false });
  if (['active', 'unsubscribed'].includes(status)) q = q.eq('status', status);
  const { data } = await q.limit(500);

  const all = data || [];
  const [{ count: clientCount }, { count: activeCount }, { count: unsubCount }] = await Promise.all([
    db.from('clients').select('id').count(),
    db.from('subscribers').select('id').eq('status', 'active').count(),
    db.from('subscribers').select('id').eq('status', 'unsubscribed').count(),
  ]);

  res.json({
    ok: true,
    subscribers: all,
    stats: { active: activeCount || 0, unsubscribed: unsubCount || 0, clients: clientCount || 0 },
  });
}));

/**
 * Add addresses by hand — a walk-in client, a friend of the studio, a list
 * collected on paper. One at a time or a pasted block, both land here.
 */
router.post('/subscribers', wrap(async (req, res) => {
  const b = req.body || {};
  const raw = Array.isArray(b.emails) ? b.emails.join('\n') : String(b.email || b.emails || '');
  const candidates = [...new Set(
    raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
  )].slice(0, 300);

  if (!candidates.length) throw new ApiError(400, 'Add at least one email address.', 'VALIDATION');

  const added = [];
  const already = [];
  const invalid = [];

  for (const email of candidates) {
    if (!EMAIL_RE.test(email)) { invalid.push(email); continue; }
    const { data: existing } = await db.from('subscribers').select('id,status').eq('email', email).maybeSingle();
    if (existing) {
      if (existing.status === 'active') { already.push(email); continue; }
      await db.from('subscribers').update({ status: 'active', unsubscribed_at: null, source: 'studio' }).eq('id', existing.id);
      added.push(email);
      continue;
    }
    await db.from('subscribers').insert({ email, source: 'studio', name: clean(b.name, 120) || null, status: 'active' });
    added.push(email);
  }

  if (added.length) await log(req.user, 'subscribers_added', `${added.length} address${added.length === 1 ? '' : 'es'}`);
  res.status(added.length ? 201 : 200).json({
    ok: true,
    added,
    already_on_list: already,
    invalid,
    message: added.length
      ? `Added ${added.length} address${added.length === 1 ? '' : 'es'}${already.length ? ` · ${already.length} were already on the list` : ''}${invalid.length ? ` · ${invalid.length} looked invalid` : ''}.`
      : `Nothing added — ${already.length ? 'all already on the list' : 'no valid addresses'}${invalid.length ? ` · ${invalid.length} invalid` : ''}.`,
  });
}));

/** Switch someone off by hand, exactly as if they had pressed unsubscribe. */
router.post('/subscribers/:id/unsubscribe', wrap(async (req, res) => {
  const { data } = await db
    .from('subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('email')
    .maybeSingle();
  if (!data) throw new ApiError(404, 'That address is no longer on the list.');
  await log(req.user, 'subscriber_unsubscribed_by_studio', data.email);
  res.json({ ok: true, message: `${data.email} will not receive studio letters.` });
}));

/** Put someone back on the list. */
router.post('/subscribers/:id/resubscribe', wrap(async (req, res) => {
  const { data } = await db
    .from('subscribers')
    .update({ status: 'active', unsubscribed_at: null })
    .eq('id', req.params.id)
    .select('email')
    .maybeSingle();
  if (!data) throw new ApiError(404, 'That address is no longer on the list.');
  await log(req.user, 'subscriber_resubscribed_by_studio', data.email);
  res.json({ ok: true, message: `${data.email} is back on the studio letters list.` });
}));

/** Remove someone from the list entirely. */
router.delete('/subscribers/:id', wrap(async (req, res) => {
  const { data } = await db.from('subscribers').delete().eq('id', req.params.id).select('email').maybeSingle();
  if (data) await log(req.user, 'subscriber_deleted', data.email);
  res.json({ ok: true });
}));

/* ─────────────────────────── Receipts ─────────────────────────── */

const PAYMENT_METHODS = ['Card', 'Cash', 'Bank transfer', 'Voucher', 'Pay in studio'];

/**
 * Everything a printed receipt needs, in one round trip.
 * Notes stay private unless the studio ticks "show notes" on the printout.
 */
router.get('/appointments/:id/receipt', wrap(async (req, res) => {
  const { data: a } = await db
    .from('appointments')
    .select('id,reference,appointment_date,time,end_time,duration_minutes,price_cents,status,notes,source,created_at,completed_at,clients(name,email,phone),services(name,category,duration_minutes,price_cents),stylists(name,title)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!a) throw new ApiError(404, 'That appointment no longer exists.');

  const settings = await getSettings();
  const studio = await studioContext(settings);

  const service = a.services || {};
  const stylist = a.stylists || {};
  const client = a.clients || {};
  const price = Number(a.price_cents) || 0;
  const linePrice = Number(service.price_cents) || price;

  res.json({
    ok: true,
    receipt: {
      number: String(a.reference || a.id.slice(0, 8)).toUpperCase(),
      issued_at: a.completed_at || a.created_at,
      appointment: {
        id: a.id,
        date: a.appointment_date,
        time: a.time,
        end_time: a.end_time,
        status: a.status,
        booked_via: a.source,
        notes: a.notes || null,
      },
      client: { name: client.name || 'Walk-in', email: client.email || '', phone: client.phone || '' },
      stylist: { name: stylist.name || '', title: stylist.title || '' },
      items: [{
        description: service.name || 'Salon service',
        detail: [service.category, stylist.name].filter(Boolean).join(' · '),
        duration_minutes: a.duration_minutes || service.duration_minutes || 0,
        qty: 1,
        unit_cents: linePrice,
        total_cents: price,
      }],
      subtotal_cents: price,
      discount_cents: 0,
      total_cents: price,
      paid: ['completed', 'in_chair'].includes(a.status),
      payment_methods: PAYMENT_METHODS,
      studio: {
        name: studio.name,
        address: studio.address,
        phone: studio.phone,
        email: studio.email,
        url: studio.url,
      },
    },
  });
}));

/* ─────────────────────────── Messages & reviews ─────────────────────────── */

router.get('/messages', wrap(async (_req, res) => {
  const { data } = await db.from('messages').select('*').order('created_at', { ascending: false }).limit(100);
  res.json({ ok: true, messages: data || [] });
}));

router.patch('/messages/:id', wrap(async (req, res) => {
  const status = clean((req.body || {}).status, 20) || 'read';
  const { data } = await db.from('messages').update({ status }).eq('id', req.params.id).select('*').single();
  res.json({ ok: true, message: data });
}));

/**
 * Answer an enquiry from inside the admin.
 *
 * Sends through the studio's own SMTP account, so the client sees the studio's
 * address and a plain reply from their inbox lands back with the studio. Every
 * reply is stored against the message so the thread survives a page reload.
 */
router.post('/messages/:id/reply', wrap(async (req, res) => {
  const body = req.body || {};
  const { data: message } = await db
    .from('messages')
    .select('id,name,email,subject,message,status,created_at')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!message) throw new ApiError(404, 'That message is no longer here.');

  const text = String(body.body || '').trim();
  if (text.length < 2) throw new ApiError(400, 'Write a reply first.', 'VALIDATION');
  if (text.length > 5000) throw new ApiError(400, 'That reply is too long — keep it under 5000 characters.', 'VALIDATION');
  if (!mailer.isConfigured()) {
    throw new ApiError(400, 'Email is not configured, so the reply cannot be sent.', 'SMTP_ERROR');
  }

  const settings = await getSettings();
  const studio = await studioContext(settings);

  /* the client's own words, trimmed away from the address */
  const original = String(message.message || '').trim();
  const quoted = original.length > 900 ? `${original.slice(0, 900)}…` : original;
  const subject = clean(body.subject, 160)
    || `Re: ${message.subject || 'your message to Lumina Salon'}`;

  const signatureName = (req.user && req.user.name) || 'The studio';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escWithBreaks(p)}</p>`)
    .join('');

  const result = await mailer.send({
    to: message.email,
    subject,
    template: 'studio-reply',
    replyTo: studio.email,
    data: {
      name: studio.name,
      address: studio.address,
      phone: studio.phone,
      email: studio.email,
      preheader: text.slice(0, 120),
      headline: 'A note back from the studio',
      bodyHtml: paragraphs,
      signature: `<strong style="color:#172726;">${escapeHtml(signatureName)}</strong><br />${escapeHtml(studio.name)}<br />
        <a href="tel:${String(studio.phone || '').replace(/[^0-9+]/g, '')}" style="color:#005552;text-decoration:none;">${escapeHtml(studio.phone || '')}</a>`,
      original: quoted,
      buttonLabel: 'Book a chair',
      buttonUrl: `${studio.url}/booking`,
    },
    text: `${text}\n\n— ${signatureName}, ${studio.name}\n${studio.phone} · ${studio.email}\n\nYour original message:\n${quoted}`,
  });

  if (!result.ok) {
    throw new ApiError(502, `The email did not go out: ${result.error || 'unknown error'}. Nothing was saved — try again.`, 'SMTP_ERROR');
  }

  const { data: saved } = await db
    .from('message_replies')
    .insert({
      message_id: message.id,
      body: text,
      to_email: message.email,
      subject,
      sent_by: signatureName,
      provider_id: result.id || null,
    })
    .select('*')
    .single();

  /* replying closes the loop: it is no longer an unanswered enquiry */
  if (message.status === 'new') {
    await db.from('messages').update({ status: 'replied' }).eq('id', message.id);
  }
  await log(req.user, 'message_replied', `${message.name} <${message.email}>`);

  res.status(201).json({
    ok: true,
    reply: saved,
    message: `Reply sent to ${message.email}.`,
  });
}));

/** The thread for one enquiry. */
router.get('/messages/:id', wrap(async (req, res) => {
  const { data: message } = await db.from('messages').select('*').eq('id', req.params.id).maybeSingle();
  if (!message) throw new ApiError(404, 'That message is no longer here.');
  const { data: replies } = await db
    .from('message_replies')
    .select('id,body,to_email,subject,sent_by,created_at')
    .eq('message_id', req.params.id)
    .order('created_at');
  res.json({ ok: true, message, replies: replies || [] });
}));

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Newlines inside a paragraph become line breaks; nothing else is trusted. */
function escWithBreaks(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

router.get('/reviews', wrap(async (_req, res) => {
  const { data } = await db.from('reviews').select('*').order('sort_order');
  res.json({ ok: true, reviews: data || [] });
}));

router.patch('/reviews/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('is_published' in b) patch.is_published = !!b.is_published;
  if ('is_featured' in b) patch.is_featured = !!b.is_featured;
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if ('quote' in b) patch.quote = clean(b.quote, 600);
  const { data } = await db.from('reviews').update(patch).eq('id', req.params.id).select('*').single();
  res.json({ ok: true, review: data });
}));

/* ─────────────────────────── Helpers ─────────────────────────── */

async function log(user, action, detail) {
  try {
    await db.from('activity_log').insert({ actor: user ? user.name : 'Studio', action, detail: detail || null });
  } catch { /* logging must never break a request */ }
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

module.exports = router;
