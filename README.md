# Hearth — Lumina Salon

A complete, production-shaped website + studio back office for a boutique hair salon.

- **Public site** — Home, Services, Booking, Contact (one shared `style.css`, one `core.js`)
- **Booking engine** — real availability, overlap-safe slot generation, no double booking
- **Studio admin** — overview dashboard, day sheet with check-in, services & pricing, clients with colour formulas, inbox, working hours, settings
- **Node.js backend** — Express API (no framework magic), Supabase (Postgres) for data
- **Design system** — Hearth: Fraunces display serif + DM Sans, cream paper grounds, botanical teal, honey gold, muted plum

---

## 1. What is in here

```
lumina-salon/
├── api/index.js               # Vercel serverless entry → the Express app
├── server/
│   ├── app.js                 # Express app: API + static hosting + errors
│   ├── index.js               # local server (node server/index.js)
│   ├── db.js                  # tiny PostgREST client (no SDK needed)
│   ├── db/schema.sql          # full Postgres schema (idempotent)
│   ├── lib/                   # auth, time, schedule, settings, helpers
│   └── routes/                # public.js · auth.js · admin.js
├── public/
│   ├── index.html             # Home
│   ├── services.html          # Filterable service menu
│   ├── booking.html           # 4-step booking flow
│   ├── contact.html           # Contact + stylised map
│   ├── admin.html             # Studio back office (SPA-ish, hash routed)
│   ├── 404.html
│   └── assets/
│       ├── css/style.css      # the whole design system (~2.2k lines, one file)
│       ├── js/core.js         # icons, api client, toasts, shell
│       ├── js/home.js · services.js · booking.js · contact.js · admin.js
│       ├── fonts/             # self-hosted Fraunces + DM Sans (woff2)
│       └── *.jpg              # studio + stylist photography
├── scripts/
│   ├── setup-db.js            # creates the first admin + seeds services/hours/reviews/clients
│   ├── seed-demo.js           # optional: fills today's schedule with demo bookings
│   └── seed-data.js           # the seed content
├── vercel.json                # static hosting + /api rewrite
└── .env.example
```

---

## 2. Run it locally

```bash
npm install
cp .env.example .env      # then fill in Supabase + JWT secret
npm start                 # http://localhost:3000
```

| URL | What |
| --- | --- |
| `/` | Public website |
| `/booking` | Booking flow |
| `/admin` | Studio back office |

### Photography & brand assets

The studio supplied its own image set; everything below lives in `public/assets/`
and is referenced from Supabase (`services.image_url`) rather than hard-coded.

| File | Used for |
| --- | --- |
| `logo.svg` / `favicon.svg` | The botanical mark — the single brand glyph, inlined into every page header |
| `hero-salon.jpg` | Home hero: the studio floor, arched mirrors, travertine counter |
| `signature-technique.jpg` | Home "signature technique" block |
| `services/signature-balayage.jpg` | Signature Balayage |
| `services/precision-haircut.jpg` | Precision Haircut |
| `services/gloss-and-toning.jpg` | Gloss & Toning Treatment |
| `services/signature-balayage.jpg` (shared) | also Root Touch-Up |
| `services/master-color-retouch.jpg` | Master Color Retouch |
| `services/deep-conditioning.jpg` | Deep Conditioning Luxury |
| `services/bridal-updo.jpg` | Bridal Updo Styling |
| `*-thumb.jpg` | 220 px crops for the booking step 1 picker |

Services without a photograph automatically render the typographic tile (studio
mark + category), so the grid keeps an even rhythm. To attach a photo, drop the
file in `public/assets/services/` and set the path in **Admin → Services & pricing
→ Edit → Service photo** (or `services.image_url` in Postgres).

**Demo sign-in:** `elena@luminasalon.com` / `LuminaStudio2026!`

---

## 3. Environment variables

| Key | Purpose |
| --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side only — never expose to the browser |
| `JWT_SECRET` | signing key for admin sessions |
| `SALON_TIMEZONE` | IANA zone used for "today" and slot logic (default `America/Chicago`) |
| `SETUP_ADMIN_*` | first admin account created by `scripts/setup-db.js` |
| `SMTP_HOST` | mail server — `smtp.gmail.com` |
| `SMTP_PORT` | `587` (STARTTLS) |
| `SMTP_SECURE` | `false` for 587, `true` for 465 |
| `SMTP_USER` | the Gmail address that sends |
| `SMTP_PASS` | a Google **App Password** (not the account password) |
| `MAIL_FROM` / `MAIL_FROM_NAME` | envelope sender and display name |
| `NOTIFY_EMAIL` | studio inbox for internal alerts (falls back to `SMTP_USER`) |
| `PUBLIC_SITE_URL` | absolute URL used inside emails, e.g. `https://salonlumina.vercel.app` |

**None of the mail values belong in the repo.** Set them in Vercel → Project →
Settings → Environment Variables (`.env` locally). Email degrades quietly: if the
credentials are missing the site still books, it simply sends nothing.

---

## 4. Database setup

1. Open the Supabase **SQL editor** and paste `server/db/schema.sql` → Run.
   (Idempotent: safe to run again.)
2. Then:

```bash
npm run db:setup     # admin user + services + hours + reviews + clients + formulas
npm run db:seed      # optional demo bookings for today
```

### Schema at a glance

| Table | Holds |
| --- | --- |
| `admin_users` | studio team, bcrypt password hashes, roles |
| `stylists` | chairs, specialities, rating, avatar |
| `stylist_availability` | weekly hours per chair (weekday 0 = Monday) |
| `time_off` | holiday blocks |
| `services` | menu: category, duration, price, badge, featured |
| `clients` | contact details, notes, visit count, lifetime value |
| `client_formulas` | colour recipes: formula, developer, processing time, notes |
| `appointments` | date, `HH:MM` time, end time, status, source, price |
| `reviews` | published testimonials |
| `messages` | contact form enquiries |
| `subscribers` | newsletter |
| `settings` | key/value booking policy + studio details |
| `activity_log` | dashboard feed |

Row level security is **on** for every table: the browser never talks to Supabase directly,
only to the Node API, which uses the service-role key.

There is also a `book_appointment()` Postgres function and `appointment_detail` view for
reporting / atomic booking if you outgrow the API-level check.

---

## 5. API

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | service + Supabase status |
| `GET` | `/api/services` | `?category=Coloring` |
| `GET` | `/api/stylists` | active chairs |
| `GET` | `/api/stylists/:id/availability` | weekly hours + next 7 days |
| `GET` | `/api/availability?stylist_id&service_id&date` | real slots, with `available` + `reason` |
| `POST` | `/api/bookings` | creates/updates client, validates the slot, returns reference |
| `GET` | `/api/bookings/:reference` | booking lookup |
| `POST` | `/api/bookings/:reference/cancel` | client cancellation |
| `POST` | `/api/contact` | enquiry → `messages` |
| `POST` | `/api/subscribe` | newsletter |
| `GET` | `/api/reviews` · `/api/studio` | marketing content |

### Auth

`POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password` · `GET /api/auth/team`

Sessions are signed JWTs in an `HttpOnly`, `SameSite=Lax` cookie (12h).

### Admin (all require session)

`GET /api/admin/overview` · `GET|POST /api/admin/appointments` ·
`PATCH /api/admin/appointments/:id/status` · `PATCH|DELETE /api/admin/appointments/:id` ·
`GET|POST /api/admin/clients` · `GET|PATCH /api/admin/clients/:id` ·
`POST /api/admin/clients/:id/formulas` · `DELETE /api/admin/formulas/:id` ·
`GET|POST /api/admin/services` · `PATCH|DELETE /api/admin/services/:id` ·
`GET|PUT /api/admin/availability` · `GET|PUT /api/admin/settings` ·
`GET /api/admin/messages` · `PATCH /api/admin/messages/:id` · `GET|PATCH /api/admin/reviews` ·
`GET /api/admin/email/status` · `POST /api/admin/email/test` ·
`GET|POST /api/admin/announcements` · `PATCH|DELETE /api/admin/announcements/:id` ·
`POST /api/admin/announcements/:id/send` · `POST|DELETE /api/admin/services/:id/photo`

**Appointment statuses:** `pending → confirmed → in_chair → completed` plus `cancelled`, `no_show`.
Completing a visit rolls the client's `visit_count`, `total_spent_cents` and `last_visit_date`.

---

## 6. Email

Nodemailer over SMTP, configured entirely from environment variables
(`server/lib/mailer.js`). Templates live in `server/lib/emails.js` — table layout,
inline styles, a text fallback — and `server/lib/mailContext.js` turns database rows
into the flat values the templates print.

| Email | Fires when | To |
| --- | --- | --- |
| Booking request / confirmation | client books online | client |
| Booking alert | client books online | `NOTIFY_EMAIL` |
| Appointment confirmed | status → `confirmed` | client |
| Appointment moved | date or time changed | client |
| Appointment cancelled | status → `cancelled` | client |
| Website enquiry | contact form | `NOTIFY_EMAIL` |
| Announcement | admin presses *Email to clients* | every client with an email |

Sending never blocks a booking: every call is awaited inside `try/catch` and returns
`{ ok, error }`. **Admin → Email** shows the live connection and has a *Send test* button.

Pass `"silent": true` in a status/reschedule PATCH body to skip the client email.

---

## 7. Announcements

**Admin → Announcements** manages the bar above the site header on every page.

- `title` (also the broadcast subject), `message`, `link_label`, `link_url`
- `variant` — `info` (forest), `gold`, `plum`, `urgent`
- `starts_at` / `ends_at` — optional window; the bar appears and disappears by itself
- `is_active` — pause without deleting
- *Email to clients* — renders the `announcement` template to every client with an address

`GET /api/studio` picks the newest active announcement whose window contains *now* and
returns `announcement`, `announcement_link_label`, `announcement_link_url`,
`announcement_variant`. The plain `settings.announcement` line is the fallback shown
when nothing is scheduled. The table is `announcements` (see `server/db/schema.sql`).

---

## 8. Service photos

**Admin → Services → Edit → Upload photo** sends the file to Supabase Storage
(bucket `service-photos`, created on first use) and stores the public URL in
`services.image_url`. Vercel's filesystem is read-only, so uploads must go to object
storage — never to `public/`. *Use tile instead* clears the photo and restores the
typographic tile. JPG, PNG, WebP or AVIF, up to 4 MB.

---

## 9. Booking rules

Set these in **Admin → Settings** (stored in `settings`, no deploy needed):

- **Slot interval** — default 30 min
- **Minimum notice** — default 120 min (no same-hour online bookings)
- **Book ahead** — default 90 days
- **Auto-confirm** — off means online bookings arrive as `pending` requests you approve
- **Free cancellation** — default 24 h (copy shown to clients)

Slot generation lives in `server/lib/schedule.js`: it walks the stylist's working day in
interval steps, drops anything that overlaps a booking, the team break, or the notice
window. Two people clicking the same slot at once: the second request re-checks the
appointments table and returns `409 SLOT_TAKEN`, and the UI refreshes availability.

---

## 10. Deploy to Vercel

1. Push this repo to GitHub.
2. Vercel → **Add New… → Project → Import** the repo.
3. Framework preset: **Other**. Build command: none. Output: leave default
   (`public/` is served statically, `api/index.js` handles `/api/*` via `vercel.json`).
4. Add environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
   `SALON_TIMEZONE`).
5. Deploy → your site is live on `https://<project>.vercel.app`.

`vercel.json` rewrites `/api/:path*` → `/api`, adds long-cache headers for `/assets/*`,
and sets clean URLs so `/booking` works as well as `/booking.html`.

---

## 11. Design system — Hearth

| Token | Value |
| --- | --- |
| Primary (botanical teal) | `#005552` |
| Primary soft | `#D7F0ED` |
| Secondary (honey gold) | `#DEAD55` |
| Tertiary (muted plum) | `#9C698B` |
| Page background | `#FAF4EB` |
| Surface / inset | `#FFFDF9` / `#F2ECE1` |
| Ink / ink-2 / line | `#172726` / `#67635C` / `#DFD9D0` |
| Display | Fraunces 300–700, variable, opsz 9–144 |
| Body | DM Sans 300–700, variable |
| Radii | 6 / 8 / 12 / 16 / 24 / pill |
| Motion | 150ms state, 250ms surfaces, 550–900ms reveals |

Everything above lives in `:root` in `public/assets/css/style.css`, so the whole site
(public + admin) can be re-themed from one block.

Accessibility: visible focus rings, `aria-pressed`/`aria-current` on toggles, labelled
form fields with inline errors, focus-trapped modals and panels, `prefers-reduced-motion`
support, and AA contrast on all text pairs.

---

## 12. Notes / next steps

- Email is not sent by the API yet — wire Resend/Postmark into `POST /api/bookings`
  and `POST /api/contact` (`server/routes/public.js`) when you have a domain.
- Payments are intentionally out of scope (pay in studio), matching the original journey doc.
- Add stylists by inserting into `stylists` + `stylist_availability`; the booking page and
  admin pick them up automatically.
- `appointment_detail` view is ready for Metabase / CSV reporting if needed.
