'use strict';

const jwt = require('jsonwebtoken');
const db = require('../db');
const { ApiError, clean } = require('./util');

const SECRET = process.env.JWT_SECRET || 'lumina-dev-secret-change-me';
const COOKIE = 'lumina_session';
const MAX_AGE = 1000 * 60 * 60 * 12;

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, SECRET, {
    expiresIn: '12h',
  });
}

function setCookie(res, token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE / 1000}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies ? req.cookies[COOKIE] : null;
}

/** Loads the admin user for this request, or null. */
async function currentUser(req) {
  const token = readToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  const { data } = await db
    .from('admin_users')
    .select('id,name,email,role,title,avatar_initials,is_active')
    .eq('id', payload.sub)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data;
}

/** Express middleware: 401 unless a valid admin session exists. */
async function requireAdmin(req, _res, next) {
  try {
    const user = await currentUser(req);
    if (!user) throw new ApiError(401, 'Please sign in to continue.', 'UNAUTHORIZED');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: clean(u.title, 80),
    initials: u.avatar_initials || initials(u.name),
  };
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

module.exports = { sign, setCookie, clearCookie, currentUser, requireAdmin, publicUser, initials, COOKIE };
