// Vercel serverless entry point — every /api/* request is handled by the
// Express app in server/app.js.
const app = require('../server/app');

module.exports = app;
