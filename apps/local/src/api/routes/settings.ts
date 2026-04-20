import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { getSetting, setSetting, getRatePerMinute } from '../../db/seed-settings';
import { DEFAULT_RATE_PER_MINUTE } from '../../constants';

const router = new Hono();

// GET /settings - Get all settings
router.get('/', async (c) => {
  try {
    const db = getDatabase();
    
    const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    
    return c.json({
      settings: {
        rate_per_minute: parseFloat(settings.rate_per_minute || String(DEFAULT_RATE_PER_MINUTE)),
        min_parking_fee: parseFloat(settings.min_parking_fee || '100'),
        business_name: settings.business_name || 'Diamond Car Wash',
        business_address: settings.business_address || '',
        whatsapp_number: settings.whatsapp_number || '',
        instagram_url: settings.instagram_url || '',
        facebook_url: settings.facebook_url || '',
      }
    });
    
  } catch (err) {
    console.error('[GET /settings]', err);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// PUT /settings - Update settings
router.put('/', async (c) => {
  try {
    const body = await c.req.json();
    const updates = body.settings || body;
    
    // Validate rate_per_minute if provided
    if (updates.rate_per_minute !== undefined) {
      const rate = parseFloat(updates.rate_per_minute);
      if (isNaN(rate) || rate < 0) {
        return c.json({ error: 'rate_per_minute must be a positive number' }, 400);
      }
      setSetting('rate_per_minute', String(rate));
    }

    if (updates.min_parking_fee !== undefined) {
      const minFee = parseFloat(updates.min_parking_fee);
      if (isNaN(minFee) || minFee < 0) {
        return c.json({ error: 'min_parking_fee must be a positive number' }, 400);
      }
      setSetting('min_parking_fee', String(minFee));
    }
    
    if (updates.business_name !== undefined) {
      setSetting('business_name', updates.business_name);
    }
    
    if (updates.business_address !== undefined) {
      setSetting('business_address', updates.business_address);
    }
    
    if (updates.whatsapp_number !== undefined) {
      setSetting('whatsapp_number', updates.whatsapp_number);
    }
    
    if (updates.instagram_url !== undefined) {
      setSetting('instagram_url', updates.instagram_url);
    }
    
    if (updates.facebook_url !== undefined) {
      setSetting('facebook_url', updates.facebook_url);
    }
    
    // Return updated settings
    const db = getDatabase();
    const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    const settings: Record<string, any> = {};
    for (const row of rows) {
      if (row.key === 'rate_per_minute') {
        settings[row.key] = parseFloat(row.value);
      } else {
        settings[row.key] = row.value;
      }
    }
    
    return c.json({ settings });
    
  } catch (err) {
    console.error('[PUT /settings]', err);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// GET /settings/rate - Quick endpoint to get just the rate
router.get('/rate', async (c) => {
  try {
    const rate = getRatePerMinute();
    return c.json({ rate_per_minute: rate });
  } catch (err) {
    console.error('[GET /settings/rate]', err);
    return c.json({ error: 'Failed to fetch rate' }, 500);
  }
});

export { router as settingsRouter };
