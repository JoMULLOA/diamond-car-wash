-- Add Max Quantity to Services
ALTER TABLE services ADD COLUMN max_quantity INTEGER NOT NULL DEFAULT 1;
