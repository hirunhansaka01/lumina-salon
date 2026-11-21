'use strict';

/**
 * Content the studio starts with. Used by scripts/setup-db.js — safe to run
 * more than once, rows are matched by slug / email.
 */

const services = [
  {
    name: 'Signature Balayage', slug: 'signature-balayage', category: 'Coloring',
    image_url: '/assets/services/signature-balayage.jpg',
    description: 'Hand-painted dimensional color with a bespoke gloss and toner, finished with a blow-dry.',
    duration_minutes: 150, price_cents: 18500, badge: 'Signature', is_featured: true, sort_order: 10,
  },
  {
    name: 'Precision Haircut', slug: 'precision-haircut', category: 'Haircuts',
    image_url: '/assets/services/precision-haircut.jpg',
    description: 'A tailored cut, wash and blow-dry shaped around your face, texture and routine.',
    duration_minutes: 45, price_cents: 6500, badge: 'Popular', is_featured: true, sort_order: 20,
  },
  {
    name: 'Gloss & Toning Treatment', slug: 'gloss-and-toning', category: 'Treatments',
    image_url: '/assets/services/gloss-and-toning.jpg',
    description: 'Refresh vibrancy and add a mirror-like shine between coloring appointments.',
    duration_minutes: 45, price_cents: 8500, badge: 'Add-on', sort_order: 30,
  },
  {
    name: 'Bridal Updo Styling', slug: 'bridal-updo', category: 'Styling',
    image_url: '/assets/services/bridal-updo.jpg',
    description: 'Custom formal styling with a trial session included, for the day itself and the morning after.',
    duration_minutes: 90, price_cents: 15000, badge: 'Specialty', sort_order: 40,
  },
  {
    name: 'Keratin Smoothing Treatment', slug: 'keratin-smoothing', category: 'Treatments',
    description: 'Eliminate frizz and achieve sleek, silky locks that hold their shape for months.',
    duration_minutes: 120, price_cents: 25000, badge: 'Trending', sort_order: 50,
  },
  {
    name: 'Root Touch-Up', slug: 'root-touch-up', category: 'Coloring',
    image_url: '/assets/services/signature-balayage.jpg',
    description: 'Seamless grey coverage and precise color matching with a soft gloss finish.',
    duration_minutes: 60, price_cents: 9500, badge: 'Essential', sort_order: 60,
  },
  {
    name: 'Editorial Blowout & Waves', slug: 'editorial-blowout', category: 'Styling',
    description: 'Voluminous round-brush finish with a soft, lived-in wave — the everyday editorial look.',
    duration_minutes: 45, price_cents: 7500, sort_order: 70,
  },
  {
    name: 'Botanical Scalp & Bond Ritual', slug: 'botanical-scalp-ritual', category: 'Treatments',
    description: 'Restorative apothecary mask, bond builder and steam therapy for scalp and ends.',
    duration_minutes: 60, price_cents: 11000, badge: 'Relax', is_featured: true, sort_order: 80,
  },
  {
    name: 'Master Color Retouch', slug: 'master-color-retouch', category: 'Coloring',
    image_url: '/assets/services/master-color-retouch.jpg',
    description: 'Root coverage and gloss refresh with Marcus, including a take-home care plan.',
    duration_minutes: 120, price_cents: 12000, sort_order: 90,
  },
  {
    name: 'Deep Conditioning Luxury', slug: 'deep-conditioning', category: 'Treatments',
    image_url: '/assets/services/deep-conditioning.jpg',
    description: 'Intense moisture restoration mask for hair that needs a quiet afternoon.',
    duration_minutes: 30, price_cents: 5000, sort_order: 100,
  },
  {
    name: 'Beard Trim & Shape', slug: 'beard-trim', category: 'Haircuts',
    description: 'Clipper and razor detailing with a hot-towel finish at the basin.',
    duration_minutes: 30, price_cents: 4500, sort_order: 110,
  },
  {
    name: 'Bridal Trial & Day-Of Package', slug: 'bridal-package', category: 'Packages',
    description: 'Trial run, wedding-day styling and touch-up kit — a calm morning, planned in advance.',
    duration_minutes: 150, price_cents: 25000, badge: 'Package', sort_order: 120,
  },
];

const stylists = [
  {
    name: 'Elena Vance', slug: 'elena-vance', title: 'Studio Lead · Cut & Colour',
    bio: 'Fifteen years behind the chair, trained in London and Chicago. Elena is known for soft, wearable shapes and colour that grows out beautifully.',
    specialties: ['Precision cutting', 'Balayage', 'Curl shaping'],
    avatar_url: '/assets/stylist-elena-thumb.jpg', avatar_initials: 'EV', sort_order: 10,
  },
  {
    name: 'Marcus Chen', slug: 'marcus-chen', title: 'Master Colorist',
    bio: 'A colour specialist with an editorial background. Marcus rescues difficult colours and builds dimension that reads natural in daylight.',
    specialties: ['Dimensional colour', 'Colour correction', 'Gloss & toner'],
    avatar_url: '/assets/stylist-marcus-thumb.jpg', avatar_initials: 'MC', sort_order: 20,
  },
];

const workingDays = [1, 2, 3, 4, 5]; // Tue → Sat (0 = Monday)

// No seeded testimonials: reviews are collected from real clients only.
const reviews = [];

const settings = {
  slot_interval_minutes: '30',
  lead_time_minutes: '120',
  max_advance_days: '90',
  booking_auto_confirm: 'false',
  cancellation_hours: '24',
  studio_address: '742 Evergreen Terrace, Springfield',
  studio_phone: '(555) 019-8234',
  studio_email: 'hello@luminasalon.com',
  notify_email: 'studio@luminasalon.com',
  announcement: 'Now booking December colour — bespoke balayage and gloss appointments open.',
};

// No seeded clients: the client list starts empty.
const clients = [];

// No seeded colour formulas: these are recorded per real client.
const formulas = [];

module.exports = { services, stylists, workingDays, reviews, settings, clients, formulas };
