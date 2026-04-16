import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { setSetting } from '../../db/seed-settings';
import type { Subscription } from '../../constants';

const router = new Hono();

// POST /sync/subscriptions - Sync subscriptions from cloud to local
router.post('/subscriptions', async (c) => {
  try {
    const body = await c.req.json();
    const { subscriptions } = body as { subscriptions: Subscription[] };
    
    if (!Array.isArray(subscriptions)) {
      return c.json({ error: 'subscriptions must be an array' }, 400);
    }
    
    const db = getDatabase();
    const now = Date.now();
    let synced = 0;
    let skipped = 0;
    
    db.transaction(async () => {
      for (const sub of subscriptions) {
        // Skip if already synced and not updated
        const existing = await db.get<{ synced_at: number }>(
          `SELECT synced_at FROM subscriptions_cache WHERE id = ?`,
          [sub.id]
        );
        
        if (existing && existing.synced_at >= sub.updated_at) {
          skipped++;
          continue;
        }
        
        await db.run(
          `INSERT OR REPLACE INTO subscriptions_cache 
           (id, patent, owner_name, owner_email, start_date, end_date, status, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sub.id, sub.patent, sub.owner_name, sub.owner_email || null,
           sub.start_date, sub.end_date, sub.status, now]
        );
        
        await db.run(
          `INSERT INTO sync_log (entity_type, entity_id, action, synced_at)
           VALUES (?, ?, ?, ?)`,
          ['subscription', sub.id, 'sync', now]
        );
        
        synced++;
      }
    });
    
    // Update last sync timestamp
    setSetting('last_sync', String(now));
    
    return c.json({
      success: true,
      synced,
      skipped,
      synced_at: now,
    });
    
  } catch (err) {
    console.error('[POST /sync/subscriptions]', err);
    return c.json({ error: 'Failed to sync subscriptions' }, 500);
  }
});

// GET /sync/status - Get sync status
router.get('/status', async (c) => {
  try {
    const db = getDatabase();
    
    const lastSync = await db.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_sync'"
    );
    
    const subCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM subscriptions_cache'
    );
    
    const activeSubCount = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM subscriptions_cache 
       WHERE status = 'active' AND end_date >= ?`,
      [Date.now()]
    );
    
    return c.json({
      last_sync: lastSync ? parseInt(lastSync.value) : null,
      total_subscriptions: subCount?.count ?? 0,
      active_subscriptions: activeSubCount?.count ?? 0,
    });
    
  } catch (err) {
    console.error('[GET /sync/status]', err);
    return c.json({ error: 'Failed to get sync status' }, 500);
  }
});

export { router as syncRouter };
