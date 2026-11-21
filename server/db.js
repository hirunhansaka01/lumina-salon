'use strict';

/**
 * A tiny promise-based Supabase client for Node.
 *
 * It talks to the PostgREST REST API with the service-role key, which keeps the
 * server dependency-free (works on Vercel's Node runtime with global fetch) and
 * gives us a familiar query-builder surface.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn('[db] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — API calls will fail.');
}

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this._select = '*';
    this._order = [];
    this._limit = null;
    this._method = 'GET';
    this._body = null;
    this._single = null;
    this._count = null;
    this._headers = {};
  }

  select(columns = '*') { this._select = columns; return this; }
  insert(rows) { this._method = 'POST'; this._body = rows; this._headers.Prefer = 'return=representation'; return this; }
  update(patch) { this._method = 'PATCH'; this._body = patch; this._headers.Prefer = 'return=representation'; return this; }
  delete() { this._method = 'DELETE'; return this; }

  eq(column, value) { this.filters.push(`${column}=eq.${encodeURIComponent(value)}`); return this; }
  neq(column, value) { this.filters.push(`${column}=neq.${encodeURIComponent(value)}`); return this; }
  in(column, values) { this.filters.push(`${column}=in.(${values.map((v) => encodeURIComponent(v)).join(',')})`); return this; }
  gte(column, value) { this.filters.push(`${column}=gte.${encodeURIComponent(value)}`); return this; }
  lte(column, value) { this.filters.push(`${column}=lte.${encodeURIComponent(value)}`); return this; }
  order(column, { ascending = true } = {}) { this._order.push(`${column}.${ascending ? 'asc' : 'desc'}`); return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = 'single'; this._headers.Accept = 'application/vnd.pgrst.object+json'; return this; }
  /** Returns the first row or null — implemented with limit(1) so it never 406s. */
  maybeSingle() { this._single = 'maybe'; this._limit = 1; return this; }
  count() { this._count = 'exact'; this._headers.Prefer = [this._headers.Prefer, 'count=exact'].filter(Boolean).join(','); return this; }

  async _run() {
    const parts = [];
    const push = (k, v) => parts.push(`${k}=${encodeURIComponent(String(v)).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')')}`);

    if (this._method === 'GET' || this._method === 'PATCH' || this._method === 'DELETE') push('select', this._select);
    if (this._order.length) push('order', this._order.join(','));
    if (this._limit) push('limit', this._limit);
    for (const f of this.filters) parts.push(f);

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...this._headers,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${this.table}?${parts.join('&')}`, {
      method: this._method,
      headers,
      body: this._body ? JSON.stringify(this._body) : undefined,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      if (this._single === 'maybe' && (res.status === 406 || res.status === 404)) return { data: null, error: null, count: 0 };
      const err = new Error((data && (data.message || data.hint || data.details)) || `Supabase ${res.status}`);
      err.status = res.status;
      err.detail = data;
      throw err;
    }

    let count = null;
    const range = res.headers.get('content-range');
    if (range && range.includes('/')) count = Number(range.split('/')[1]);

    if (this._single === 'maybe') {
      data = Array.isArray(data) ? (data[0] || null) : data;
    }
    return { data, error: null, count };
  }

  then(resolve, reject) { return this._run().then(resolve, reject); }
}

const db = {
  from(table) { return new Query(table); },

  /** Call a Postgres function (used for the atomic booking transaction). */
  async rpc(name, args = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) {
      const err = new Error((data && (data.message || data.hint)) || `Supabase rpc ${res.status}`);
      err.status = res.status;
      err.detail = data;
      throw err;
    }
    return data;
  },

  url: SUPABASE_URL,
};

module.exports = db;
