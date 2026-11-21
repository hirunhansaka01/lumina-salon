'use strict';

const express = require('express');
const db = require('../db');
const { wrap, clean, normEmail, normPhone, requireFields, EMAIL_RE, ApiError } = require('../lib/util');
const { getSettings } = require('../lib/settings');
const { isValidISODate, isValidTime, toMinutes, formatTime12, salonDate, salonTime, addDays, weekdayIndex } = require('../lib/time');
const { BLOCKING } = require('../lib/schedule');

const router = express.Router();

/* ─────────────────────────── Services ─────────────────────────── */

router.get('/services', wrap(async (req, res) => {
  const category = clean(req.query.category, 40);
  let q = db
    .from('services')
    .select('id,name,slug,category,description,duration_minutes,price_cents,badge,is_featured,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (category && category !== 'all') q = q.eq('category', category);
  const { data } = await q;

  const services = (data || []).map(mapService);
  res.json({ ok: true, services, categories: [...new Set(services.map((s) => s.category))] });
}));

function mapService(s) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    category: s.category,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price_cents: s.price_cents,
    price: s.price_cents / 100,
    badge: s.badge || null,
    is_featured: !!s.is_featured,
  };
}

/* ─────────────────────────── Stylists ─────────────────────────── */

router.get('/stylists', wrap(async (_req, res) => {
  const { data } = await db
    .from('stylists')
    .select('id,name,slug,title,bio,specialties,avatar_url,rating,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order');
  res.json({ ok: true, stylists: data || [] });
}));

/** Weekly working hours + the next 7 days, used by the booking page. */
router.get('/stylists/:id/availability', wrap(async (req, res) => {
  const stylistId = req.params.id;
  const { data: stylist } = await db.from('stylists').select('id,name,title,avatar_url').eq('id', stylistId).maybeSingle();
  if (!stylist) throw new ApiError(404, 'Stylist not found.');

  const { data: rows } = await db
    .from('stylist_availability')
    .select('*')
    .eq('stylist_id', stylistId)
    .order('weekday');

  const today = salonDate();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const row = (rows || []).find((r) => r.weekday === weekdayIndex(date));
    days.push({
      date,
      is_working: row ? !!row.is_working : false,
      start_time: row ? row.start_time : null,
      end_time: row ? row.end_time : null,
    });
  }

  res.json({ ok: true, stylist, week: rows || [], days });
}));

/** Concrete bookable slots for one stylist + service + date. */
router.get('/availability', wrap(async (req, res) => {
  const { buildSlots } = require('../lib/schedule');
  const stylistId = clean(req.query.stylist_id, 40);
  const serviceId = clean(req.query.service_id, 40);
  const date = clean(req.query.date, 10);

  if (!stylistId || !isValidISODate(date)) throw new ApiError(400, 'A stylist and a valid date are required.');

  let duration = 60;
  if (serviceId) {
    const { data: service } = await db.from('services').select('duration_minutes').eq('id', serviceId).maybeSingle();
    if (service) duration = service.duration_minutes;
  }

  const settings = await getSettings();
  const maxDate = addDays(salonDate(), settings.max_advance_days);
  if (date > maxDate) {
    return res.json({ ok: true, date, duration, slots: [], message: `Bookings open up to ${settings.max_advance_days} days ahead.` });
  }

  const { data: availability } = await db
    .from('stylist_availability')
    .select('*')
    .eq('stylist_id', stylistId)
    .eq('weekday', weekdayIndex(date))
    .maybeSingle();

  const { data: appointments } = await db
    .from('appointments')
    .select('time,end_time,status')
    .eq('stylist_id', stylistId)
    .eq('appointment_date', date);

  const result = buildSlots({
    appointments: appointments || [],
    availability,
    settings,
    duration,
    date,
    nowDate: salonDate(),
    nowTime: salonTime(),
  });

  res.json({ ok: true, date, duration, ...result });
}));

/* ─────────────────────────── Booking ─────────────────────────── */

router.post('/bookings', wrap(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['name', 'email', 'stylist_id', 'service_id', 'date', 'time']);
  if (!EMAIL_RE.test(normEmail(body.email))) throw new ApiError(400, 'Please enter a valid email address.', 'VALIDATION');
  if (!isValidISODate(body.date) || !isValidTime(body.time)) throw new ApiError(400, 'Please choose a valid date and time.', 'VALIDATION');

  const settings = await getSettings();
  const { data: service } = await db.from('services').select('*').eq('id', body.service_id).maybeSingle();
  if (!service || !service.is_active) throw new ApiError(400, 'That service is no longer available.');

  const { data: stylist } = await db.from('stylists').select('*').eq('id', body.stylist_id).maybeSingle();
  if (!stylist || !stylist.is_active) throw new ApiError(400, 'Please choose a stylist.');

  const { data: availability } = await db
    .from('stylist_availability')
    .select('*')
    .eq('stylist_id', stylist.id)
    .eq('weekday', weekdayIndex(body.date))
    .maybeSingle();
  if (!availability || !availability.is_working) throw new ApiError(409, `${stylist.name} is not in the studio on that day.`);

  if (body.date < salonDate()) throw new ApiError(409, 'That date is in the past.');

  const end = toMinutes(body.time) + service.duration_minutes;
  if (toMinutes(body.time) < toMinutes(availability.start_time) || end > toMinutes(availability.end_time)) {
    throw new ApiError(409, 'That time is outside studio hours.');
  }
  if (availability.break_start && availability.break_end) {
    if (toMinutes(body.time) < toMinutes(availability.break_end) && end > toMinutes(availability.break_start)) {
      throw new ApiError(409, 'That time overlaps the team break.');
    }
  }

  const { data: clash } = await db
    .from('appointments')
    .select('id,time,end_time,status')
    .eq('stylist_id', stylist.id)
    .eq('appointment_date', body.date);
  const taken = (clash || []).filter(
    (a) => BLOCKING.includes(a.status) && toMinutes(body.time) < toMinutes(a.end_time) && toMinutes(a.time) < end
  );
  if (taken.length) throw new ApiError(409, 'That slot was just taken. Please pick another time.', 'SLOT_TAKEN');

  /* upsert the client by email */
  const email = normEmail(body.email);
  const clientPatch = {
    name: clean(body.name, 120),
    email,
    phone: normPhone(body.phone),
    notes: clean(body.notes, 1000) || null,
    last_visit_date: null,
  };
  const { data: existing } = await db.from('clients').select('id,visit_count,total_spent_cents').eq('email', email).maybeSingle();

  let client;
  if (existing) {
    const { data } = await db.from('clients').update(clientPatch).eq('id', existing.id).select('*').single();
    client = data;
  } else {
    const { data } = await db.from('clients').insert({ ...clientPatch, visit_count: 0, total_spent_cents: 0 }).select('*').single();
    client = data;
  }

  const status = settings.booking_auto_confirm ? 'confirmed' : 'pending';
  const { data: appointment } = await db
    .from('appointments')
    .insert({
      client_id: client.id,
      stylist_id: stylist.id,
      service_id: service.id,
      appointment_date: body.date,
      time: body.time,
      end_time: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents,
      status,
      source: 'online',
      notes: clean(body.notes, 1000) || null,
    })
    .select('*, services(name), stylists(name)')
    .single();

  /* keep the studio inbox useful */
  await db.from('activity_log').insert({
    actor: client.name,
    action: 'booking_created',
    detail: `${service.name} with ${stylist.name} on ${body.date} at ${formatTime12(body.time)}`,
  }).then(() => {}).catch(() => {});

  res.status(201).json({
    ok: true,
    appointment: {
      id: appointment.id,
      date: appointment.appointment_date,
      time: appointment.time,
      end_time: appointment.end_time,
      status: appointment.status,
      service: service.name,
      stylist: stylist.name,
      price: service.price_cents / 100,
      duration_minutes: service.duration_minutes,
    },
    client: { name: client.name, email: client.email },
    message: status === 'confirmed'
      ? 'Your appointment is confirmed. We look forward to seeing you.'
      : 'Your request is in. We will confirm by email within a few hours.',
  });
}));

/** Look up an existing appointment (confirmation screen / cancel link). */
router.get('/bookings/:code', wrap(async (req, res) => {
  const { data } = await db
    .from('appointments')
    .select('id,reference,appointment_date,time,end_time,status,price_cents,duration_minutes,services(name,duration_minutes),stylists(name,title),clients(name,email,phone)')
    .eq('reference', req.params.code.toUpperCase())
    .maybeSingle();
  if (!data) throw new ApiError(404, 'We could not find that booking.');
  res.json({ ok: true, appointment: data });
}));

router.post('/bookings/:code/cancel', wrap(async (req, res) => {
  const { data } = await db
    .from('appointments')
    .select('id,status,appointment_date,time')
    .eq('reference', req.params.code.toUpperCase())
    .maybeSingle();
  if (!data) throw new ApiError(404, 'We could not find that booking.');
  if (['cancelled', 'completed'].includes(data.status)) throw new ApiError(409, 'That appointment can no longer be changed.');

  await db.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', data.id);
  res.json({ ok: true, message: 'Your appointment has been cancelled. We hope to see you soon.' });
}));

/* ─────────────────────────── Contact ─────────────────────────── */

router.post('/contact', wrap(async (req, res) => {
  const body = req.body || {};
  requireFields(body, ['name', 'email', 'message']);
  if (!EMAIL_RE.test(normEmail(body.email))) throw new ApiError(400, 'Please enter a valid email address.', 'VALIDATION');
  if (clean(body.message).length < 5) throw new ApiError(400, 'Please add a little more detail to your message.', 'VALIDATION');

  const { data } = await db
    .from('messages')
    .insert({
      name: clean(body.name, 120),
      email: normEmail(body.email),
      phone: normPhone(body.phone) || null,
      subject: clean(body.subject, 160) || 'Website enquiry',
      message: String(body.message).slice(0, 4000),
      status: 'new',
    })
    .select('id')
    .single();

  await db.from('activity_log').insert({
    actor: clean(body.name, 120),
    action: 'message_received',
    detail: clean(body.subject, 160) || 'Website enquiry',
  }).then(() => {}).catch(() => {});

  res.status(201).json({ ok: true, id: data.id, message: 'Thank you — your message is with us. We reply within 24 hours.' });
}));

/* ─────────────────────────── Newsletter ─────────────────────────── */

router.post('/subscribe', wrap(async (req, res) => {
  const email = normEmail((req.body || {}).email);
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please enter a valid email address.', 'VALIDATION');
  const { data: existing } = await db.from('subscribers').select('id').eq('email', email).maybeSingle();
  if (!existing) await db.from('subscribers').insert({ email, source: 'website' });
  res.status(201).json({ ok: true, message: 'You are on the list. Look out for our seasonal letters.' });
}));

/* ─────────────────────────── Reviews + studio info ─────────────────────────── */

router.get('/reviews', wrap(async (_req, res) => {
  const { data } = await db
    .from('reviews')
    .select('id,quote,client_name,location,rating,is_featured')
    .eq('is_published', true)
    .order('sort_order')
    .limit(12);
  res.json({ ok: true, reviews: data || [] });
}));

router.get('/studio', wrap(async (_req, res) => {
  const s = await getSettings();
  res.json({
    ok: true,
    studio: {
      name: process.env.SALON_NAME || 'Lumina Salon',
      address: s.studio_address,
      phone: s.studio_phone,
      email: s.studio_email,
      announcement: s.announcement,
      cancellation_hours: s.cancellation_hours,
      auto_confirm: s.booking_auto_confirm,
    },
  });
}));

module.exports = router;
