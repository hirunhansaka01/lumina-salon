'use strict';

/**
 * Service photography uploads.
 *
 * Vercel's filesystem is read-only and ephemeral, so images cannot be written
 * into the deployment. Supabase Storage is the durable home: files land in a
 * public bucket and the service keeps only the resulting URL.
 *
 * The bucket is created on first use, so no manual setup is required.
 */

const crypto = require('crypto');

let bucketReady = null;

const apiBase = () => `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1`;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BUCKET = process.env.SUPABASE_BUCKET || 'service-photos';
const MAX_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies around 4.5 MB

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && serviceKey());
}

/** Create the public bucket once per process (idempotent). */
async function ensureBucket() {
  if (bucketReady) return bucketReady;
  if (!isConfigured()) return { ok: false, error: 'Supabase storage is not configured.' };
  try {
    const res = await fetch(`${apiBase()}/bucket`, {
      method: 'POST',
      headers: {
        apikey: serviceKey(),
        authorization: `Bearer ${serviceKey()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_BYTES }),
    });
    // 400/409 simply means it already exists
    if (!res.ok && ![400, 409].includes(res.status)) {
      const text = await res.text().catch(() => '');
      bucketReady = { ok: false, error: `Bucket: ${res.status} ${text.slice(0, 160)}` };
      return bucketReady;
    }
    bucketReady = { ok: true, bucket: BUCKET };
    return bucketReady;
  } catch (err) {
    bucketReady = { ok: false, error: err.message };
    return bucketReady;
  }
}

/**
 * Upload one image.
 * @param {Buffer} buffer raw bytes
 * @param {string} mimeType image/jpeg | image/png | image/webp | image/avif
 * @param {string} hint filename-ish label used to build a nice path
 * @returns {Promise<{ok:boolean,url?:string,path?:string,error?:string}>}
 */
async function uploadImage(buffer, mimeType, hint = 'service') {
  if (!isConfigured()) return { ok: false, error: 'Supabase storage is not configured.' };
  const ext = ALLOWED[mimeType];
  if (!ext) return { ok: false, error: 'Please use a JPG, PNG, WebP or AVIF image.' };
  if (!buffer || !buffer.length) return { ok: false, error: 'The file was empty.' };
  if (buffer.length > MAX_BYTES) return { ok: false, error: 'That image is larger than 4 MB — please compress it first.' };

  const ready = await ensureBucket();
  if (!ready.ok) return ready;

  const slug = String(hint)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'service';
  const stamp = crypto.randomBytes(5).toString('hex');
  const path = `${slug}-${stamp}.${ext}`;

  try {
    const res = await fetch(`${apiBase()}/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey(),
        authorization: `Bearer ${serviceKey()}`,
        'content-type': mimeType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Upload failed: ${res.status} ${text.slice(0, 160)}` };
    }
    const url = `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`;
    return { ok: true, url, path };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Accepts a data: URL (what the browser reads from the file input). */
async function uploadDataUrl(dataUrl, hint) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) return { ok: false, error: 'That file could not be read.' };
  const [, mime, b64] = match;
  return uploadImage(Buffer.from(b64, 'base64'), mime, hint);
}

module.exports = { uploadImage, uploadDataUrl, ensureBucket, isConfigured, BUCKET, MAX_BYTES };
