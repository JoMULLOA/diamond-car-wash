-- Diamond Car Wash - Initial Schema Migration
-- Creates all tables for the parking system

-- ============================================
-- Table: vehicles
-- Stores registered vehicle patents
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  patent TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('minute', 'subscription')) DEFAULT 'minute',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicles_patent ON vehicles(patent);

-- ============================================
-- Table: entries
-- Tracks vehicle entry/exit movements
-- ============================================
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  entry_time INTEGER NOT NULL,
  exit_time INTEGER,
  status TEXT NOT NULL CHECK(status IN ('active', 'closed')) DEFAULT 'active',
  total_minutes INTEGER,
  sync_status TEXT NOT NULL CHECK(sync_status IN ('local', 'synced')) DEFAULT 'local',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_vehicle_id ON entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_entry_time ON entries(entry_time);

-- ============================================
-- Table: payments
-- Records all payment transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id),
  amount REAL NOT NULL,
  rate_per_minute REAL NOT NULL,
  payment_time INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_entry_id ON payments(entry_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_time ON payments(payment_time);

-- ============================================
-- Table: settings
-- Key-value store for app configuration
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================
-- Table: subscriptions_cache
-- Local copy of cloud subscriptions for offline use
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions_cache (
  id TEXT PRIMARY KEY,
  patent TEXT NOT NULL UNIQUE,
  owner_name TEXT,
  owner_email TEXT,
  start_date INTEGER,
  end_date INTEGER,
  status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_cache_patent ON subscriptions_cache(patent);
CREATE INDEX IF NOT EXISTS idx_subscriptions_cache_status ON subscriptions_cache(status);

-- ============================================
-- Table: sync_log
-- Audit log for synchronization operations
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);

-- ============================================
-- Insert default settings
-- ============================================
INSERT OR REPLACE INTO settings (key, value) VALUES ('rate_per_minute', '5');
INSERT OR REPLACE INTO settings (key, value) VALUES ('business_name', 'Diamond Car Wash');
INSERT OR REPLACE INTO settings (key, value) VALUES ('business_address', '');
