// Types
export * from './types/index';

// Schemas
export { 
  patentSchema, 
  normalizePatent, 
  tryNormalizePatent,
  detectPatentType,
  getPatentType,
  getPatentTypeDescription,
  isCurrentPatent,
  isHistoricalPatent,
  isConsonant,
} from './schemas/patent';
export type { PatentInput, NormalizedPatent, PatentType } from './schemas/patent';

// Constants
export const APP_NAME = 'Diamond Car Wash';
export const DEFAULT_RATE_PER_MINUTE = 5; // $5 per minute default
export const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
