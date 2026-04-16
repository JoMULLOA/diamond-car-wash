// Shared constants for the Diamond Car Wash system

export const APP_NAME = 'Diamond Car Wash';
export const DEFAULT_RATE_PER_MINUTE = 5; // $5 per minute default
export const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Patent normalization
export function normalizePatent(patent: string): string {
  return patent
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function tryNormalizePatent(patent: string): string | null {
  try {
    const normalized = normalizePatent(patent);
    // Basic validation: at least 5 chars (e.g., ABC12)
    if (normalized.length >= 5) {
      return normalized;
    }
    return null;
  } catch {
    return null;
  }
}

// Type definitions
export type VehicleType = 'minute' | 'subscription';
export type EntryStatus = 'active' | 'closed';
export type SyncStatus = 'local' | 'synced';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Vehicle {
  id: string;
  patent: string;
  type: VehicleType;
  created_at: number;
  updated_at: number;
}

export interface Entry {
  id: string;
  vehicle_id: string;
  entry_time: number;
  exit_time: number | null;
  status: EntryStatus;
  total_minutes: number | null;
  sync_status: SyncStatus;
}

export interface Payment {
  id: string;
  entry_id: string;
  amount: number;
  rate_per_minute: number;
  payment_time: number;
}

export interface Subscription {
  id: string;
  patent: string;
  owner_name: string;
  owner_email: string | null;
  start_date: number;
  end_date: number;
  status: SubscriptionStatus;
  created_at: number;
  updated_at: number;
}

export interface SubscriptionCache {
  id: string;
  patent: string;
  owner_name: string | null;
  owner_email: string | null;
  start_date: number | null;
  end_date: number | null;
  status: SubscriptionStatus;
  synced_at: number;
}

export interface Settings {
  rate_per_minute: number;
  business_name: string;
  business_address: string;
}

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
