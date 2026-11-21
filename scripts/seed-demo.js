'use strict';

/**
 * Optional: fills today's schedule with a realistic mix of bookings so the
 * dashboard and booking page feel alive while you evaluate the build.
 *
 *   node scripts/seed-demo.js
 */

require('dotenv').config();
const db = require('../server/db');
const { salonDate, toMinutes, fromMinutes } = require('../server/lib/time');

const DEMO = [
  ['09:00', 'Sarah Jenkins', 'Signature Balayage', 'Elena Vance', 'in_chair'],
  ['10:00', 'David Miller', 'Precision Haircut', 'Marcus Chen', 'confirmed'],
  ['11:30', 'Chloe Bennett', 'Bridal Updo Styling', 'Elena Vance', 'confirmed'],
  ['12:30', 'Amanda Ross', 'Gloss & Toning Treatment', 'Elena Vance', 'pending'],
  ['14:00', 'Priya Raman', 'Keratin Smoothing Treatment', 'Marcus Chen', 'confirmed'],
  ['15:45', 'Tom Whitfield', 'Beard Trim & Shape', 'Marcus Chen', 'confirmed'],
  ['17:00', 'Chloe Bennett', 'Editorial Blowout & Waves', 'Elena Vance', 'confirmed'],
];

async function main() {
  const today = salonDate();
  const [{ data: services }, { data: stylists }, { data: clients }] = await Promise.all([
    db.from('services').select('id,name,duration_minutes,price_cents'),
    db.from('stylists').select('id,name'),
    db.from('clients').select('id,name,email'),
  ]);

  /* demo clients (matched by email) — never re-insert existing rows */
  const DEMO_CLIENTS = [
    ['Sarah Jenkins', 'sarah.jenkins@example.com', '(555) 014-2210'],
    ['David Miller', 'david.miller@example.com', '(555) 017-3388'],
    ['Chloe Bennett', 'chloe.bennett@example.com', '(555) 012-7741'],
    ['Amanda Ross', 'amanda.ross@example.com', '(555) 019-1120'],
    ['Priya Raman', 'priya.raman@example.com', '(555) 016-5502'],
    ['Tom Whitfield', 'tom.whitfield@example.com', '(555) 011-6689'],
  ];
  for (const [name, email, phone] of DEMO_CLIENTS) {
    const exists = await db.from('clients').select('id').eq('email', email).maybeSingle();
    if (!exists.data) {
      await db.from('clients').insert({ name, email, phone, visit_count: 0, total_spent_cents: 0 });
    }
  }
  const clientRows = (await db.from('clients').select('id,name')).data || [];

  let created = 0;
  for (const [time, clientName, serviceName, stylistName, status] of DEMO) {
    const service = (services || []).find((s) => s.name === serviceName);
    const stylist = (stylists || []).find((s) => s.name === stylistName);
    const client = clientRows.find((c) => c.name === clientName);
    if (!service || !stylist || !client) { console.warn('· skipped', clientName, serviceName); continue; }

    const already = await db
      .from('appointments')
      .select('id')
      .eq('appointment_date', today)
      .eq('time', time)
      .eq('stylist_id', stylist.id)
      .maybeSingle();
    if (already.data) continue;

    const end = toMinutes(time) + service.duration_minutes;
    await db.from('appointments').insert({
      client_id: client.id,
      stylist_id: stylist.id,
      service_id: service.id,
      appointment_date: today,
      time,
      end_time: fromMinutes(end),
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents,
      status,
      source: 'phone',
    });
    created++;
  }

  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  console.log(`✓ demo schedule for ${today}: ${created} appointments created`);
}

main().catch((err) => { console.error('✗', err.message); process.exit(1); });
