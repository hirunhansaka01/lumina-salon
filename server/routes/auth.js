'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { wrap, ApiError, normEmail, clean } = require('../lib/util');
const { sign, setCookie, clearCookie, currentUser, publicUser } = require('../lib/auth');

const router = express.Router();

router.post('/login', wrap(async (req, res) => {
  const email = normEmail((req.body || {}).email);
  const password = String((req.body || {}).password || '');

  if (!email || !password) throw new ApiError(400, 'Enter your email and password.', 'VALIDATION');

  const { data: user } = await db.from('admin_users').select('*').eq('email', email).maybeSingle();
  const fakeHash = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, user ? user.password_hash : fakeHash);

  if (!user || !ok || !user.is_active) {
    throw new ApiError(401, 'That email and password do not match our records.', 'BAD_CREDENTIALS');
  }

  const token = sign(user);
  setCookie(res, token);
  await db.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  res.json({ ok: true, token, user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

router.get('/me', wrap(async (req, res) => {
  const user = await currentUser(req);
  if (!user) throw new ApiError(401, 'Not signed in.', 'UNAUTHORIZED');
  res.json({ ok: true, user: publicUser(user) });
}));

router.post('/password', wrap(async (req, res) => {
  const user = await currentUser(req);
  if (!user) throw new ApiError(401, 'Not signed in.', 'UNAUTHORIZED');

  const { current_password: current, new_password: next } = req.body || {};
  if (String(next || '').length < 8) throw new ApiError(400, 'New password must be at least 8 characters.', 'VALIDATION');

  const { data: row } = await db.from('admin_users').select('password_hash').eq('id', user.id).single();
  const ok = await bcrypt.compare(String(current || ''), row.password_hash);
  if (!ok) throw new ApiError(400, 'Your current password is not correct.', 'VALIDATION');

  await db.from('admin_users').update({ password_hash: await bcrypt.hash(String(next), 10) }).eq('id', user.id);
  res.json({ ok: true, message: 'Password updated.' });
}));

/** Team list for the settings panel. */
router.get('/team', wrap(async (_req, res) => {
  const { data } = await db.from('admin_users').select('id,name,email,role,title,last_login_at,is_active').order('name');
  res.json({ ok: true, team: data || [] });
}));

module.exports = router;
