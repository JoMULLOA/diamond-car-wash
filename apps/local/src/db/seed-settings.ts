import { db } from './index';

// Default rate: $5 per minute
const DEFAULT_RATE_PER_MINUTE = 5;

// Default minimum charge per parking: $100 CLP
const DEFAULT_MIN_PARKING_FEE = 100;

/**
 * Seed default settings if not present
 */
export async function seedSettings(): Promise<void> {
  const defaults = [
    { key: 'rate_per_minute', value: String(DEFAULT_RATE_PER_MINUTE) },
    { key: 'min_parking_fee', value: String(DEFAULT_MIN_PARKING_FEE) },
    { key: 'business_name', value: 'Diamond Car Wash' },
    { key: 'business_address', value: '' },
    { key: 'whatsapp_number', value: '56940889752' },
    { key: 'instagram_url', value: 'https://www.instagram.com/diamondcarwash.arauco/' },
    { key: 'facebook_url', value: 'https://www.facebook.com/people/DiamondcarwuashArauco/100064216656842/' },
    { key: 'max_capacity', value: '50' },
  ];

  for (const setting of defaults) {
    await db.run(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
  console.log('[Seed] Default settings inserted');
}

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

/**
 * Get rate per minute
 */
export async function getRatePerMinute(): Promise<number> {
  const value = await getSetting('rate_per_minute');
  return value ? parseFloat(value) : DEFAULT_RATE_PER_MINUTE;
}

/**
 * Get minimum parking fee
 */
export async function getMinParkingFee(): Promise<number> {
  const value = await getSetting('min_parking_fee');
  return value ? parseFloat(value) : DEFAULT_MIN_PARKING_FEE;
}

/**
 * Get maximum parking capacity
 */
export async function getMaxCapacity(): Promise<number> {
  const value = await getSetting('max_capacity');
  return value ? parseInt(value) : 50;
}
