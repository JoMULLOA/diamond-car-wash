-- Diamond Car Wash - Multi Service Booking Schema

-- ============================================
-- Table: booking_services
-- Link table for many-to-many relationship between bookings and services
-- ============================================
CREATE TABLE IF NOT EXISTS booking_services (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id),
  PRIMARY KEY (booking_id, service_id)
);

-- Backfill existing bookings into booking_services
INSERT OR IGNORE INTO booking_services (booking_id, service_id)
SELECT id, service_id FROM bookings;
