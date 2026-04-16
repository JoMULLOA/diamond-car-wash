import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import type { DashboardStats, EntryWithVehicle } from '../../constants';

const router = new Hono();

// GET /dashboard/stats - Get dashboard statistics
router.get('/stats', async (c) => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    // Get start of today (midnight)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();
    
    // Active entries count
    const activeEntries = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM entries WHERE status = 'active'`
    );
    
    // Today's revenue
    const todayPayments = await db.get<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM payments
       WHERE payment_time >= ?`,
      [startOfTodayMs]
    );
    
    // Last sync timestamp
    const lastSync = await db.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_sync'"
    );
    
    const stats: DashboardStats = {
      active_entries: activeEntries?.count ?? 0,
      total_today: todayPayments?.count ?? 0,
      revenue_today: todayPayments?.total ?? 0,
      last_sync: lastSync ? parseInt(lastSync.value) : null,
    };
    
    return c.json({ stats });
    
  } catch (err) {
    console.error('[GET /dashboard/stats]', err);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
});

// GET /dashboard/recent - Get recent entries (last 10)
router.get('/recent', async (c) => {
  try {
    const db = getDatabase();
    const limit = parseInt(c.req.query('limit') || '10');
    
    const entries = await db.all<EntryWithVehicle>(
      `SELECT e.*, v.patent, v.type as vehicle_type
       FROM entries e
       JOIN vehicles v ON e.vehicle_id = v.id
       ORDER BY e.created_at DESC
       LIMIT ?`,
      [limit]
    );
    
    return c.json({ entries });
    
  } catch (err) {
    console.error('[GET /dashboard/recent]', err);
    return c.json({ error: 'Failed to fetch recent entries' }, 500);
  }
});

export { router as dashboardRouter };
