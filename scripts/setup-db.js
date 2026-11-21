'use strict';

/**
 * One-time (idempotent) setup: creates the first admin account and loads the
 * studio's starting content into Supabase.
 *
 *   node scripts/setup-db.js
 *
 * Requires the schema to exist — see server/db/schema.sql (paste it into the
 * Supabase SQL editor, or wire it into CI).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../server/db');
const seed = require('./seed-data');

async function main() {
  if (!db.url) {
    console.error('Missing SUPABASE_URL. Copy .env.example to .env first.');
    process.exit(1);
  }
  console.log('→ Supabase:', db.url);

  /* ── admin user ── */
  const email = (process.env.SETUP_ADMIN_EMAIL || 'elena@luminasalon.com').toLowerCase();
  const existing = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (existing.data) {
    console.log('· admin already exists:', email);
  } else {
    await db.from('admin_users').insert({
      name: process.env.SETUP_ADMIN_NAME || 'Elena Vance',
      email,
      password_hash: await bcrypt.hash(process.env.SETUP_ADMIN_PASSWORD || 'LuminaStudio2026!', 10),
      role: 'owner',
      title: 'Studio Lead',
      avatar_initials: 'EV',
    });
    console.log('✓ admin created:', email);
  }

  /* ── stylists ── */
  for (const s of seed.stylists) {
    const found = await db.from('stylists').select('id').eq('slug', s.slug).maybeSingle();
    if (found.data) { console.log('· stylist exists:', s.name); continue; }
    await db.from('stylists').insert({ ...s, is_active: true });
    console.log('✓ stylist:', s.name);
  }

  const { data: stylistRows } = await db.from('stylists').select('id,name');
  const elena = (stylistRows || []).find((s) => s.name === 'Elena Vance');
  const marcus = (stylistRows || []).find((s) => s.name === 'Marcus Chen');

  /* ── weekly hours ── */
  for (const stylist of [elena, marcus].filter(Boolean)) {
    const { data: rows } = await db.from('stylist_availability').select('weekday').eq('stylist_id', stylist.id);
    const have = new Set((rows || []).map((r) => r.weekday));
    for (let weekday = 0; weekday < 7; weekday++) {
      if (have.has(weekday)) continue;
      await db.from('stylist_availability').insert({
        stylist_id: stylist.id,
        weekday,
        is_working: seed.workingDays.includes(weekday),
        start_time: '09:00',
        end_time: '19:00',
        break_start: '13:00',
        break_end: '13:30',
      });
    }
    console.log('✓ hours:', stylist.name);
  }

  /* ── services ── */
  for (const s of seed.services) {
    const found = await db.from('services').select('id,image_url').eq('slug', s.slug).maybeSingle();
    if (found.data) {
      if (s.image_url && found.data.image_url !== s.image_url) {
        await db.from('services').update({ image_url: s.image_url }).eq('slug', s.slug);
        console.log('✓ service photo updated:', s.name);
      } else {
        console.log('· service exists:', s.name);
      }
      continue;
    }
    await db.from('services').insert({ ...s, is_active: true });
    console.log('✓ service:', s.name);
  }

  /* ── reviews ── */
  const { data: reviewRows } = await db.from('reviews').select('id').limit(1);
  if (!reviewRows || !reviewRows.length) {
    for (const r of seed.reviews) await db.from('reviews').insert({ ...r, is_published: true });
    console.log('✓ reviews:', seed.reviews.length);
  }

  /* ── settings ── */
  for (const [key, value] of Object.entries(seed.settings)) {
    const found = await db.from('settings').select('key').eq('key', key).maybeSingle();
    if (found.data) continue;
    await db.from('settings').insert({ key, value });
  }
  console.log('✓ settings');

  /* ── sample clients + formulas ── */
  for (const c of seed.clients) {
    const found = await db.from('clients').select('id').eq('email', c.email).maybeSingle();
    if (found.data) continue;
    await db.from('clients').insert({ ...c, visit_count: 0, total_spent_cents: 0 });
    console.log('✓ client:', c.name);
  }

  const { data: clientRows } = await db.from('clients').select('id,email');
  for (const f of seed.formulas) {
    const client = (clientRows || []).find((c) => c.email === f.email);
    if (!client) continue;
    const { data: existingFormula } = await db.from('client_formulas').select('id').eq('client_id', client.id).limit(1);
    if (existingFormulas(existingFormula)) continue;
    await db.from('client_formulas').insert({
      client_id: client.id,
      formula: f.formula,
      developer: f.developer,
      processing_minutes: f.processing_minutes,
      stylist_id: elena ? elena.id : null,
      notes: f.notes,
      created_by: 'Elena Vance',
    });
    console.log('✓ formula for', f.email);
  }

  console.log('\nDone. Sign in at /admin with', email);
}

function existingFormulas(rows) { return Array.isArray(rows) && rows.length > 0; }

main().catch((err) => {
  console.error('\n✗ setup failed:', err.message);
  if (err.detail) console.error(err.detail);
  process.exit(1);
});
