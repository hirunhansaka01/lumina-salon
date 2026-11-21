'use strict';

const express = require('express');
const db = require('../db');
const { wrap, ApiError, clean, normEmail, normPhone, EMAIL_RE } = require('../lib/util');
const { requireAdmin } = require('../lib/auth');
const { getSettings, invalidate, NUMERIC, BOOLEAN } = require('../lib/settings');
const { isValidISODate, isValidTime, toMinutes, fromMinutes, salonDate, salonTime, addDays, weekdayIndex, prettyDate } = require('../lib/time');
const { STATUSES } = require('../lib/schedule');

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
