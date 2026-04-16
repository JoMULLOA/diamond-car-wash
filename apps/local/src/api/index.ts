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
import { initDatabase, closeDatabase } from '../db';
import { serveStatic } from '@hono/node-server/serve-static';

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
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
    console.log('[Server] Initializing database...');
    await initDatabase();
    initialized = true;
    console.log('[Server] Database ready');
  }
  await next();
});

// Mount routes
app.route('/api/entries', entriesRouter);
app.route('/api/subscriptions', subscriptionsRouter);
app.route('/api/memberships', membershipsRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/sync', syncRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/history', historyRouter);
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
