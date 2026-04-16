import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { normalizePatent } from '../../constants';
import type { SubscriptionCache } from '../../constants';

const router = new Hono();

// GET /subscriptions/check/:patent - Check if patent has active subscription
router.get('/check/:patent', async (c) => {
  try {
    const patent = c.req.param('patent');
    const normalizedPatent = normalizePatent(patent);
    const now = Date.now();
    
    const db = getDatabase();
    
    const subscription = await db.get<SubscriptionCache>(
      `SELECT * FROM subscriptions_cache
       WHERE patent = ? AND status = 'active' AND end_date >= ?`,
      [normalizedPatent, now]
    );
    
    if (!subscription) {
      return c.json({ 
        valid: false,
        patent: normalizedPatent,
        reason: 'No active subscription found'
      });
    }
    
    return c.json({
      valid: true,
      patent: normalizedPatent,
      subscription: {
        id: subscription.id,
        owner_name: subscription.owner_name,
        owner_email: subscription.owner_email,
        end_date: subscription.end_date,
        days_remaining: subscription.end_date 
          ? Math.ceil((subscription.end_date - now) / (24 * 60 * 60 * 1000)) 
          : null,
      }
    });
    
  } catch (err: any) {
    console.error('[GET /subscriptions/check/:patent]', err);
    return c.json({ error: 'Failed to check subscription' }, 500);
  }
});

// GET /subscriptions - List all subscriptions
router.get('/', async (c) => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    const subscriptions = await db.all<SubscriptionCache>(
      `SELECT * FROM subscriptions_cache
       ORDER BY end_date DESC`
    );
    
    // Add status info
    const withStatus = subscriptions.map(sub => ({
      ...sub,
      is_active: sub.status === 'active' && (sub.end_date ? sub.end_date >= now : false),
      days_remaining: sub.end_date ? Math.ceil((sub.end_date - now) / (24 * 60 * 60 * 1000)) : null,
    }));
    
    return c.json({ subscriptions: withStatus });
    
  } catch (err) {
    console.error('[GET /subscriptions]', err);
    return c.json({ error: 'Failed to fetch subscriptions' }, 500);
  }
});

// DELETE /subscriptions/:id - Remove a subscription from cache
router.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();
    
    await db.run('DELETE FROM subscriptions_cache WHERE id = ?', [id]);
    
    return c.json({ success: true });
    
  } catch (err) {
    console.error('[DELETE /subscriptions/:id]', err);
    return c.json({ error: 'Failed to delete subscription' }, 500);
  }
});

export { router as subscriptionsRouter };
