-- =====================================================================
--  Hearth — Lumina Salon · database schema
--  Run once (scripts/setup-db.js does this for you) or paste into the
--  Supabase SQL editor. Safe to re-run: everything is idempotent.
-- =====================================================================

create extension if not exists pgcrypto;

-- Shared updated_at trigger ------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── Admin users ────────────────────────────────────────────────────────
create table if not exists admin_users (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  email            text        not null unique,
  password_hash    text        not null,
  role             text        not null default 'owner',
  title            text,
  avatar_initials  text,
  is_active        boolean     not null default true,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now()
);

-- ── Stylists ───────────────────────────────────────────────────────────
create table if not exists stylists (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  slug             text        not null unique,
  title            text,
  bio              text,
  specialties      text[]      not null default '{}',
  avatar_url       text,
  avatar_initials  text,
  rating           numeric(2,1) not null default 5.0,
  is_active        boolean     not null default true,
  sort_order       int         not null default 0,
  created_at       timestamptz not null default now()
);

-- ── Services ───────────────────────────────────────────────────────────
create table if not exists services (
  id                uuid primary key default gen_random_uuid(),
  name              text        not null,
  slug              text        not null unique,
  category          text        not null default 'Haircuts',
  description       text,
  duration_minutes  int         not null default 45,
  price_cents       int         not null default 0,
  badge             text,
  image_url         text,
  is_featured       boolean     not null default false,
  is_active         boolean     not null default true,
  sort_order        int         not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists services_updated_at on services;
create trigger services_updated_at before update on services
  for each row execute function set_updated_at();

-- ── Clients ────────────────────────────────────────────────────────────
create table if not exists clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text        not null,
  email              text        not null unique,
  phone              text,
  notes              text,
  allergies          text,
  visit_count        int         not null default 0,
  total_spent_cents  int         not null default 0,
  last_visit_date    date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- ── Colour formulas (the studio's memory) ──────────────────────────────
create table if not exists client_formulas (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  formula             text not null,
  developer           text,
  processing_minutes  int,
  stylist_id          uuid references stylists(id) on delete set null,
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now()
);
create index if not exists client_formulas_client_idx on client_formulas(client_id);

-- ── Appointments ───────────────────────────────────────────────────────
create table if not exists appointments (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  client_id         uuid not null references clients(id) on delete cascade,
  stylist_id        uuid not null references stylists(id) on delete restrict,
  service_id        uuid not null references services(id) on delete restrict,
  appointment_date  date not null,
  time              text not null,
  end_time          text not null,
  duration_minutes  int  not null default 45,
  price_cents       int  not null default 0,
  status            text not null default 'pending'
                    check (status in ('pending','confirmed','in_chair','completed','cancelled','no_show')),
  source            text not null default 'online',
  notes             text,
  checked_in_at     timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  status_changed_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists appointments_date_idx on appointments(appointment_date);
create index if not exists appointments_stylist_date_idx on appointments(stylist_id, appointment_date);
create index if not exists appointments_client_idx on appointments(client_id);

-- ── Weekly working hours per stylist ───────────────────────────────────
create table if not exists stylist_availability (
  id           uuid primary key default gen_random_uuid(),
  stylist_id   uuid not null references stylists(id) on delete cascade,
  weekday      int  not null check (weekday between 0 and 6),  -- 0 = Monday
  is_working   boolean not null default true,
  start_time   text not null default '09:00',
  end_time     text not null default '19:00',
  break_start  text,
  break_end    text,
  unique (stylist_id, weekday)
);

-- ── Time-off blocks ────────────────────────────────────────────────────
create table if not exists time_off (
  id          uuid primary key default gen_random_uuid(),
  stylist_id  uuid not null references stylists(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ── Reviews shown on the marketing pages ───────────────────────────────
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  location      text,
  rating        numeric(2,1) not null default 5.0,
  quote         text not null,
  is_published  boolean not null default true,
  is_featured   boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Contact messages ───────────────────────────────────────────────────
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  subject     text,
  message     text not null,
  status      text not null default 'new' check (status in ('new','read','replied','archived')),
  created_at  timestamptz not null default now()
);

-- ── Newsletter ─────────────────────────────────────────────────────────
create table if not exists subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text default 'website',
  created_at  timestamptz not null default now()
);

-- ── Key/value studio settings ──────────────────────────────────────────
create table if not exists settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ── Lightweight activity feed for the dashboard ────────────────────────
create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_log_created_idx on activity_log(created_at desc);

-- =====================================================================
--  Row level security: locked down. The Node API uses the service-role
--  key, which bypasses RLS, so the browser never touches these tables.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['admin_users','stylists','services','clients','client_formulas',
                           'appointments','stylist_availability','time_off','reviews',
                           'messages','subscribers','settings','activity_log']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- =====================================================================
--  Handy view for reporting (optional)
-- =====================================================================
create or replace view appointment_detail as
select a.id, a.reference, a.appointment_date, a.time, a.end_time, a.status,
       c.name as client_name, c.email, s.name as stylist_name,
       sv.name as service_name, sv.category, a.price_cents
from appointments a
join clients  c  on c.id  = a.client_id
join stylists s  on s.id  = a.stylist_id
join services sv on sv.id = a.service_id;

-- =====================================================================
--  Atomic booking helper — re-checks the slot after a row lock so two
--  people clicking at once cannot double-book the same chair.
-- =====================================================================
create or replace function book_appointment(
  p_client_id uuid,
  p_stylist_id uuid,
  p_service_id uuid,
  p_date date,
  p_time text,
  p_end_time text,
  p_duration int,
  p_price_cents int,
  p_status text,
  p_source text,
  p_notes text
) returns appointments as $$
declare
  clash int;
  result appointments;
begin
  perform pg_advisory_xact_lock(hashtext(p_stylist_id::text || p_date::text));

  select count(*) into clash
  from appointments
  where stylist_id = p_stylist_id
    and appointment_date = p_date
    and status in ('pending','confirmed','in_chair','completed')
    and p_time < end_time
    and time < p_end_time;

  if clash > 0 then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  insert into appointments (client_id, stylist_id, service_id, appointment_date, time,
                            end_time, duration_minutes, price_cents, status, source, notes)
  values (p_client_id, p_stylist_id, p_service_id, p_date, p_time,
          p_end_time, p_duration, p_price_cents, p_status, p_source, p_notes)
  returning * into result;

  return result;
end;
$$ language plpgsql;
