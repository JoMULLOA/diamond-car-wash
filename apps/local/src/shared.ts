// Shared types and utilities for Diamond Car Wash

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

export type MembershipType = 'parking' | 'wash';

export interface MonthlyMembership {
  id: string;
  patent: string;
  owner_name: string;
  owner_phone: string;
  type: MembershipType;
  service_id: string | null;
  monthly_price: number;
  washes_remaining: number;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface MonthlyPayment {
  id: string;
  membership_id: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  paid_at: number | null;
  created_at: number;
}

export interface Settings {
  rate_per_minute: number;
  min_parking_fee: number;
  business_name: string;
  business_address: string;
  max_capacity: number;
  parking_membership_price: number;
  whatsapp_number?: string;
  instagram_url?: string;
  facebook_url?: string;
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

// ============================================
// Booking & Agenda System Types
// ============================================

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  max_quantity: number;
  active: number; // 0 or 1 (SQLite boolean)
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  process: string | null;
  tools_used: string | null;
  created_at: number;
  updated_at: number;
}

export interface Booking {
  id: string;
  service_id: string;
  service_name?: string;
  service_duration?: number;
  client_name: string;
  client_phone: string;
  client_patent: string;
  booking_date: string; // YYYY-MM-DD (local date)
  start_time: string;   // HH:MM (local time)
  end_time: string;     // HH:MM (local time)
  status: BookingStatus;
  deposit_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  payment_option: string;
  mercado_pago_id: string | null;
  services?: { 
    id: string; 
    name: string; 
    quantity: number; 
    duration_minutes: number; 
    price: number; 
  }[];
  notes: string | null;
  created_at: number;
  updated_at: number;
}

// Patent Types
export type PatentType = 
  | 'historical_pre1940'
  | 'historical_1940s'
  | 'historical_1964'
  | 'historical_1995'
  | 'current_auto'
  | 'current_moto'
  | 'new_auto'
  | 'new_moto'
  | 'special_green'
  | 'special_military'
  | 'special_police'
  | 'special_firefighter'
  | 'special_trailer';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

export function detectPatentType(patent: string): PatentType | null {
  const clean = patent.toUpperCase().replace(/[\s.-]/g, '');
  
  if (/^\d{1,6}$/.test(clean)) return 'historical_pre1940';
  if (/^[A-Z]{2}\*[A-Z]{2}$/.test(clean)) return 'historical_1940s';
  if (/^[A-Z]{2}\*$/.test(clean)) return 'historical_1940s';
  if (/^[A-Z]\d{6,7}$/.test(clean)) return 'historical_1964';
  if (/^[A-Z]{2}[A-Z]{2}\d{2}$/.test(clean)) return 'historical_1995';
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{4}\d{2}$/.test(clean)) return 'current_auto';
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{3}\d{2}$/.test(clean)) return 'current_moto';
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{5}\d{1}$/.test(clean)) return 'new_auto';
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{4}\d{1}$/.test(clean)) return 'new_moto';
  if (/^R\d+$/.test(clean) || /^SR\d+$/.test(clean)) return 'special_trailer';
  
  return null;
}

export function getPatentType(patent: string): PatentType | null {
  return detectPatentType(patent);
}

export function getPatentTypeDescription(type: PatentType): string {
  const descriptions: Record<PatentType, string> = {
    'historical_pre1940': 'Histórica (Pre-1940)',
    'historical_1940s': 'Histórica (1940-1950)',
    'historical_1964': 'Histórica (1964-1995)',
    'historical_1995': 'Histórica (1995-2007)',
    'current_auto': 'Automóvil',
    'current_moto': 'Motocicleta',
    'new_auto': 'Automóvil (nuevo formato)',
    'new_moto': 'Motocicleta (nuevo formato)',
    'special_green': 'Eléctrico/Híbrido',
    'special_military': 'Ejército',
    'special_police': 'Carabineros',
    'special_firefighter': 'Bomberos',
    'special_trailer': 'Remolque',
  };
  return descriptions[type];
}

export function normalizePatent(patent: string): string {
  return patent.toUpperCase().replace(/[\s.-]/g, '');
}

export function tryNormalizePatent(patent: string): string | null {
  const normalized = normalizePatent(patent);
  const type = detectPatentType(normalized);
  return type !== null ? normalized : null;
}

export const DEFAULT_RATE_PER_MINUTE = 5;
export const APP_NAME = 'Diamond Car Wash';
