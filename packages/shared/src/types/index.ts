// Vehicle Types
export type VehicleType = 'minute' | 'subscription';

export interface Vehicle {
  id: string;
  patent: string; // Normalized: "ABC123"
  type: VehicleType;
  created_at: number; // Unix timestamp ms
  updated_at: number; // Unix timestamp ms
}

// Entry Types
export type EntryStatus = 'active' | 'closed';
export type SyncStatus = 'local' | 'synced';

export interface Entry {
  id: string;
  vehicle_id: string;
  entry_time: number; // Unix timestamp ms
  exit_time: number | null; // Unix timestamp ms
  status: EntryStatus;
  total_minutes: number | null;
  sync_status: SyncStatus;
}

// Payment Types
export interface Payment {
  id: string;
  entry_id: string;
  amount: number; // Final charged amount
  rate_per_minute: number; // Rate at time of payment
  payment_time: number; // Unix timestamp ms
}

// Subscription Types
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  patent: string; // "ABC123"
  owner_name: string;
  owner_email: string | null;
  start_date: number; // Unix timestamp ms
  end_date: number; // Unix timestamp ms
  status: SubscriptionStatus;
  created_at: number;
  updated_at: number;
}

// Local subscription cache (synced from cloud)
export interface SubscriptionCache {
  id: string;
  patent: string;
  owner_name: string | null;
  owner_email: string | null;
  start_date: number | null;
  end_date: number | null;
  status: SubscriptionStatus;
  synced_at: number; // Unix timestamp ms
}

// Settings
export interface Settings {
  rate_per_minute: number;
  min_parking_fee: number;
  business_name: string;
  business_address: string;
}

// API Response Types
export interface EntryWithVehicle extends Entry {
  patent: string;
  vehicle_type: VehicleType;
}

export interface ExitResult {
  entry_id: string;
  patent: string;
  entry_time: number;
  exit_time: number;
  total_minutes: number;
  rate_per_minute: number;
  amount: number;
  was_subscription: boolean;
}

export interface DashboardStats {
  active_entries: number;
  total_today: number;
  revenue_today: number;
  last_sync: number | null;
}
