-- Diamond Car Service - Add Quantity

-- SQLite doesn't let us ADD COLUMN IF NOT EXISTS easily without error, but we can do it directly.
-- Wait, using ALTER TABLE ADD COLUMN is safe unless it exists. 
-- Since we know it doesn't exist, we just add it:
ALTER TABLE booking_services ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
