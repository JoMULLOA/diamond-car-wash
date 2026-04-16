-- Diamond Car Wash - Services & Bookings Schema
-- Adds tables for the booking/agenda system

-- ============================================
-- Table: services
-- Car wash service catalog
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  media_url TEXT,
  media_type TEXT,
  process TEXT,
  tools_used TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);

-- ============================================
-- Table: bookings
-- Customer reservations / appointments
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_patent TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK(status IN ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show')),
  deposit_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  mercado_pago_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_patent ON bookings(client_patent);

-- ============================================
-- Settings for booking system
-- ============================================
INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_open_hour', '08:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_close_hour', '20:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_deposit_percent', '20');
INSERT OR IGNORE INTO settings (key, value) VALUES ('booking_slot_interval', '30');
