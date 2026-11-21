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
    image_url: '/assets/services/bridal-updo.jpg',
    description: 'Trial run, wedding-day styling and touch-up kit — a calm morning, planned in advance.',
    duration_minutes: 150, price_cents: 25000, badge: 'Package', sort_order: 120,
  },
];

const stylists = [
  {
    name: 'Elena Vance', slug: 'elena-vance', title: 'Studio Lead · Cut & Colour',
    bio: 'Fifteen years behind the chair, trained in London and Chicago. Elena is known for soft, wearable shapes and colour that grows out beautifully.',
    specialties: ['Precision cutting', 'Balayage', 'Curl shaping'],
    avatar_url: '/assets/stylist-elena-thumb.jpg', avatar_initials: 'EV', rating: 4.9, sort_order: 10,
  },
  {
    name: 'Marcus Chen', slug: 'marcus-chen', title: 'Master Colorist',
    bio: 'A colour specialist with an editorial background. Marcus rescues difficult colours and builds dimension that reads natural in daylight.',
    specialties: ['Dimensional colour', 'Colour correction', 'Gloss & toner'],
    avatar_url: '/assets/stylist-marcus-thumb.jpg', avatar_initials: 'MC', rating: 5.0, sort_order: 20,
  },
];

const workingDays = [1, 2, 3, 4, 5]; // Tue → Sat (0 = Monday)

const reviews = [
  {
    client_name: 'Sarah Jenkins', location: 'Springfield', rating: 5,
    quote: 'Elena gave me the best balayage of my life. The whole experience feels like an upscale spa day, complete with wonderful refreshments.',
    is_featured: true, sort_order: 10,
  },
  {
    client_name: 'David Miller', location: 'Springfield', rating: 5,
    quote: 'Marcus is a true master colorist. He fixed a bad colour job from another salon and kept my hair feeling incredibly healthy.',
    is_featured: true, sort_order: 20,
  },
  {
    client_name: 'Chloe Bennett', location: 'Springfield', rating: 5,
    quote: 'The attention to detail at Lumina Salon is unmatched. From the precise haircut to the warm hospitality, I will never go anywhere else.',
    is_featured: true, sort_order: 30,
  },
  {
    client_name: 'Amanda Ross', location: 'Springfield', rating: 5,
    quote: 'I always look forward to my Saturday appointments. The atmosphere is serene and the complimentary tea is a lovely touch.',
    is_featured: false, sort_order: 40,
  },
];

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

const clients = [
  { name: 'Sarah Jenkins', email: 'sarah.jenkins@example.com', phone: '(555) 014-2210', notes: 'Prefers chamomile tea. Loves a soft, lived-in wave.' },
  { name: 'David Miller', email: 'david.miller@example.com', phone: '(555) 017-3388', notes: 'Sensitive scalp — use the gentle cleanse.' },
  { name: 'Chloe Bennett', email: 'chloe.bennett@example.com', phone: '(555) 012-7741', notes: 'Bridal client, wedding in April.' },
  { name: 'Amanda Ross', email: 'amanda.ross@example.com', phone: '(555) 019-1120', notes: 'Saturday regular. Books six weeks ahead.' },
  { name: 'Priya Raman', email: 'priya.raman@example.com', phone: '(555) 016-5502', notes: 'Deep conditioning every other visit.' },
  { name: 'Tom Whitfield', email: 'tom.whitfield@example.com', phone: '(555) 011-6689', notes: 'Beard shape every three weeks.' },
];

const formulas = [
  { email: 'sarah.jenkins@example.com', formula: 'Clay lightener + 20 vol', developer: '20 vol', processing_minutes: 35, notes: 'Tone with 9G + 9NB (1:1) for 15 mins at the basin.' },
  { email: 'amanda.ross@example.com', formula: '6N + 6WB (30g each)', developer: '20 vol', processing_minutes: 35, notes: 'Root touch-up only — keep the mid-lengths off the colour.' },
  { email: 'priya.raman@example.com', formula: 'Gloss 8NB + clear (1:2)', developer: '6 vol', processing_minutes: 20, notes: 'Cool violet tone to kill brassiness at the ends.' },
];

module.exports = { services, stylists, workingDays, reviews, settings, clients, formulas };
