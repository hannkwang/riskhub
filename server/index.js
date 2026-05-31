require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const risksRouter       = require('./routes/risks');
const workflowRouter    = require('./routes/workflow');
const reviewRouter      = require('./routes/review');
const analyticsRouter   = require('./routes/analytics');
const bpRouter          = require('./routes/bestpractices');
const usersRouter       = require('./routes/users');
const systemsRouter     = require('./routes/systems');

const app  = express();
const PORT = process.env.PORT || 3001;

// In production the built frontend lives at ../dist (one level up from server/).
// In dev, the Vite dev server handles the frontend separately so this is a no-op.
const DIST = path.join(__dirname, '..', 'dist');
const isProd = fs.existsSync(path.join(DIST, 'index.html'));

// When deployed behind a reverse proxy (nginx/ALB), req.ip otherwise resolves
// to the proxy's loopback address, collapsing the per-IP rate limit into a
// single shared bucket. TRUST_PROXY can override the default chain length.
const trustProxyHops = Number(process.env.TRUST_PROXY);
if (Number.isFinite(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
} else if (isProd) {
  app.set('trust proxy', 1);
}

// In dev, Vite proxies /api/* to port 3001 — browser only sees port 5173 (same-origin).
// In prod, frontend and API are co-located — no cross-origin requests.
// Restrict CORS to the Vite dev origin so direct port-3001 access is not open to arbitrary sites.
app.use(cors({ origin: isProd ? false : 'http://localhost:5173' }));
app.use(express.json({ limit: '256kb' }));

app.use('/api/risks',          risksRouter);
app.use('/api/workflow',       workflowRouter);
app.use('/api/review',         reviewRouter);
app.use('/api/analytics',      analyticsRouter);
app.use('/api/bestpractices',  bpRouter);
app.use('/api/users',          usersRouter);
app.use('/api/systems',        systemsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve the Vite build in production; fall back to index.html for client-side routing
if (isProd) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`RiskHub running on http://localhost:${PORT}${isProd ? ' (serving built frontend)' : ' (API only — use Vite for frontend)'}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY not set — AI review endpoint will return 503');
  }
});
