import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { entriesRouter } from './routes/entries';
import { subscriptionsRouter } from './routes/subscriptions';
import { membershipsRouter } from './routes/memberships';
import { settingsRouter } from './routes/settings';
import { syncRouter } from './routes/sync';
import { dashboardRouter } from './routes/dashboard';
import { historyRouter } from './routes/history';
import { servicesRouter } from './routes/services';
import { bookingsRouter } from './routes/bookings';
import { mediaRouter } from './routes/media';
import { authRouter, authMiddleware } from './routes/auth';
import { initDatabase, closeDatabase } from '../db';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';

// Create Hono app
const app = new Hono();

// Security middleware
app.use('*', secureHeaders());

// CORS Configuration - Hardened for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000', 'https://diamondcarwash.cl', 'https://www.diamondcarwash.cl'];

app.use('*', cors({
  origin: (origin) => {
    // In dev, or if origin matches allowed origins, accept it. 
    // Always fallback to first allowed origin to allow non-browser requests like POS.
    if (!origin) return allowedOrigins[0];
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} - ${c.res.status} (${ms}ms)`);
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Initialize database on first request
let initialized = false;

app.use('*', async (c, next) => {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
  await next();
});

// Mount Auth
app.route('/api/auth', authRouter);

// Protect sensitive routers globally
app.use('/api/entries/*', authMiddleware);
app.use('/api/settings/*', authMiddleware);
app.use('/api/dashboard/*', authMiddleware);
app.use('/api/history/*', authMiddleware);
app.use('/api/sync/*', authMiddleware);

// Note: Memberships, Subscriptions, Services and Bookings 
// manage their own protection to allow public routes.

// Mount routers
app.route('/api/entries', entriesRouter);
app.route('/api/subscriptions', subscriptionsRouter);
app.route('/api/memberships', membershipsRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/sync', syncRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/history', historyRouter);

// Services, Bookings, and Media have a mix of public and private routes.
// We mount them normally and their internal router will protect specific methods.
app.route('/api/services', servicesRouter);
app.route('/api/bookings', bookingsRouter);
app.route('/api/media', mediaRouter);

// Serve static uploads
app.use('/uploads/*', serveStatic({ root: './public' }));

// Error handling
app.onError((err, c) => {
  console.error('[Error]', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  closeDatabase();
  process.exit(0);
});

export { app };
export default app;
