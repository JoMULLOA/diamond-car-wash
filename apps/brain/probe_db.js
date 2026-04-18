import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

// Manual env loading for the probe
const envPath = path.resolve(process.cwd(), 'apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/^"(.*)"$/, '$1');
});

const url = env['DATABASE_URL'];
const token = env['DATABASE_AUTH_TOKEN'];

if (!url) {
  console.error('DATABASE_URL not found in apps/web/.env.local');
  process.exit(1);
}

console.log('Testing connection to:', url);

const client = createClient({ url, authToken: token });

async function probe() {
  try {
    const rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = rs.rows.map(r => r.name);
    console.log('Tables found:', tables);
    
    for (const tableName of tables) {
      const info = await client.execute(`PRAGMA table_info(${tableName})`);
      console.log(`Table ${tableName} columns:`, info.rows.map(r => r.name));
    }
    
    // Test write permission by inserting a temp row into sync_log or similar
    // Actually, let's just try to select from bookings to see if it works
    if (tables.includes('bookings')) {
        const bookings = await client.execute("SELECT count(*) as count FROM bookings");
        console.log('Total bookings:', bookings.rows[0].count);
    }
  } catch (err) {
    console.error('Probe failed:', err);
  } finally {
    client.close();
  }
}

probe();
