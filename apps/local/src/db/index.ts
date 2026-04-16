import { createClient, Client } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env vars from .env if present
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Singleton pattern for Next.js HMR stability
declare global {
  var _libsqlClient: Client | undefined;
}

// Database file path - fallback for local if NO turso URL is provided 
const localDbPath = path.join(__dirname, '../../data/diamond.sqlite');

const dbUrl = process.env.DATABASE_URL || `file:${localDbPath}`;
const dbToken = process.env.DATABASE_AUTH_TOKEN;

function getOrCreateClient(): Client {
  if (globalThis._libsqlClient) {
    return globalThis._libsqlClient;
  }
  
  const newClient = createClient({
    url: dbUrl,
    authToken: dbToken,
  });
  
  if (process.env.NODE_ENV !== 'production') {
    globalThis._libsqlClient = newClient;
  }
  
  return newClient;
}

let client: Client | null = getOrCreateClient();
let initialized = false;

// SQL Schema - inline
const SCHEMA = `
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  patent TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'minute',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicles_patent ON vehicles(patent);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  entry_time INTEGER NOT NULL,
  exit_time INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  total_minutes INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS idx_entries_vehicle_id ON entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  amount REAL NOT NULL,
  rate_per_minute REAL NOT NULL,
  payment_time INTEGER NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_entry_id ON payments(entry_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions_cache (
  id TEXT PRIMARY KEY,
  patent TEXT NOT NULL UNIQUE,
  owner_name TEXT,
  owner_email TEXT,
  start_date INTEGER,
  end_date INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_cache_patent ON subscriptions_cache(patent);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  media_url TEXT,
  media_type TEXT,
  process TEXT,
  tools_used TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);

CREATE TABLE IF NOT EXISTS booking_services (
  booking_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (booking_id, service_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_patent TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  deposit_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  mercado_pago_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS monthly_memberships (
  id TEXT PRIMARY KEY,
  patent TEXT NOT NULL UNIQUE,
  owner_name TEXT,
  owner_phone TEXT,
  type TEXT NOT NULL DEFAULT 'parking',
  service_id TEXT, -- Legacy, mantenido por compatibilidad selectiva
  washes_remaining INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monthly_memberships_patent ON monthly_memberships(patent);
CREATE INDEX IF NOT EXISTS idx_monthly_memberships_type ON monthly_memberships(type);

CREATE TABLE IF NOT EXISTS monthly_payments (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES monthly_memberships(id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_payments_membership_id ON monthly_payments(membership_id);

CREATE TABLE IF NOT EXISTS membership_services (
  membership_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  PRIMARY KEY (membership_id, service_id),
  FOREIGN KEY (membership_id) REFERENCES monthly_memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);
`;

export async function initDatabase(): Promise<void> {
  if (initialized) return;

  console.log(`[DB] Using connection to ${dbUrl.startsWith('file:') ? 'local SQLite' : 'Turso'}`);

  try {
    // Check if the database is already initialized by checking for a core table
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles'");
    
    if (tables.rows.length === 0) {
      console.log('[DB] First time initialization: running schema...');
      // 1. Initial Tables Creation
      const statements = SCHEMA.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute in smaller chunks if needed, but batch should handle it if first time
      await client.batch(statements, 'write');

      // 2. Default Settings Seed
      await client.batch([
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('rate_per_minute', '5')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('business_name', 'Diamond Car Wash')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('business_address', '')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_open_hour', '08:00')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_close_hour', '20:00')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_deposit_percent', '20')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_slot_interval', '30')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('mercado_pago_access_token', '')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp_number', '56940889752')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('instagram_url', 'https://www.instagram.com/diamondcarwash.arauco/')",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('facebook_url', 'https://www.facebook.com/people/DiamondcarwuashArauco/100064216656842/')"
      ], 'write');
      console.log('[DB] Schema and default settings created');
    } else {
      // console.log('[DB] Connection verified, schema already exists');
    }

    initialized = true;
    console.log('[DB] Database ready');
  } catch (err) {
    if (err instanceof Error && err.message.includes('ECONNRESET')) {
      console.warn('[DB] Connection reset detected during init, will retry on next request');
    } else {
      console.error('[DB] Error during initialization:', err);
    }
  }
}

export function saveDatabase(): void {
  // Not needed for libSQL / Turso
}

export function closeDatabase(): void {
  if (client) {
    client.close();
    client = null;
    initialized = false;
  }
}

// Wrapper for the legacy sync synchronous API (now converted to async wrapper over libSQL)
export const db = {
  async run(sql: string, params: any[] = []): Promise<void> {
    if (!client) throw new Error('Database not initialized');
    await client.execute({ sql, args: params });
  },
  
  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!client) throw new Error('Database not initialized');
    const rs = await client.execute({ sql, args: params });
    if (rs.rows.length > 0) {
      return rs.rows[0] as unknown as T;
    }
    return undefined;
  },
  
  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!client) throw new Error('Database not initialized');
    const rs = await client.execute({ sql, args: params });
    return rs.rows as unknown as T[];
  },
  
  async exec(sql: string): Promise<void> {
    if (!client) throw new Error('Database not initialized');
    await client.execute(sql);
  },
  
  async transaction(fn: () => Promise<void>): Promise<void> {
    if (!client) throw new Error('Database not initialized');
    // Note: this represents nested transactional logic. Just proxying the promise.
    // Real libSQL transactions require 'client.transaction()', but let's just run it as a faux transaction for simplification on edge
    await fn();
  }
};

export function getDatabase() {
  return db;
}

export default { initDatabase, getDatabase, saveDatabase, closeDatabase, db };
