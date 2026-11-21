'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Lumina Salon running on http://localhost:${PORT}`);
  console.log(`  Studio admin:  http://localhost:${PORT}/admin`);
  console.log(`  Supabase:      ${process.env.SUPABASE_URL ? 'configured' : 'MISSING — set SUPABASE_URL'}\n`);
});
