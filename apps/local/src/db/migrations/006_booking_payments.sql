-- Migration 006: Booking payments logic (20/100)

ALTER TABLE bookings ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN remaining_balance REAL NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN payment_option TEXT NOT NULL DEFAULT '100';
