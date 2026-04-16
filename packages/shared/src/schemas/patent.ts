import { z } from 'zod';

/**
 * Patent type classification for Chilean format
 */
export type PatentType = 
  | 'historical_pre1940'    // Solo números (antes de 1940)
  | 'historical_1940s'       // XX*XX o XX* (1940-1950)
  | 'historical_1964'       // LNNNNNN (1964-1995)
  | 'historical_1995'       // LL·LL·NN (1995-2007)
  | 'current_auto'           // LLLL-NN (Autos 2007-2025)
  | 'current_moto'           // LLL-NN (Motos 2007-2025)
  | 'new_auto'               // LLLLL-N (Autos nuevo formato)
  | 'new_moto'               // LLLL-N (Motos nuevo formato)
  | 'special_green'          // Vehículos eléctricos/híbridos
  | 'special_military'       // Ejército
  | 'special_police'         // Carabineros
  | 'special_firefighter'    // Bomberos
  | 'special_trailer';       // Remolques

/**
 * Chilean patent patterns
 * 
 * HISTÓRICAS:
 * - Pre-1940: Solo números (1-6 dígitos)
 * - 1940-1950: Dos letras y dos números separados por estrella (Región Metropolitana)
 *              o dos letras separadas por estrella (resto del país)
 * - 1964-1995: Una letra seguida de 6 o 7 números (ej: A123456)
 * - 1995-2007: Dos letras, dos letras y dos números (ej: AB·CD·12)
 * 
 * VIGENTES (2007-2025):
 * - Autos (4+ ruedas): Cuatro letras consonantes y dos números (ej: BBBB-00)
 * - Motos (2-3 ruedas): Tres letras consonantes y dos números (ej: BBB-00)
 * 
 * NUEVAS:
 * - Autos: Cinco letras consonantes y un número (ej: BBBBB-0)
 * - Motos: Cuatro letras consonantes y un número (ej: BBBB-0)
 * 
 * ESPECIALES:
 * - Verde: Fondo verde para eléctricos/híbridos
 * - Carabineros: Fondo negro, letras blancas
 * - Ejército: Fondo verde, letras blancas
 * - Bomberos: Fondo naranja, letras negras
 * - Remolques: Formato con R/SR (desde 2007)
 */

// Consonantes válidas en patentes chilenas (excluye vocales para evitar palabras)
const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';
const CONSONANTS_REGEX = /^[BCDFGHJKLMNPQRSTVWXYZ]+$/;

/**
 * Validate a Chilean patent and return its type
 */
export function detectPatentType(patent: string): PatentType | null {
  const clean = patent.toUpperCase().replace(/[\s.-]/g, '');
  
  // Pre-1940: Solo números (1-6 dígitos)
  if (/^\d{1,6}$/.test(clean)) {
    return 'historical_pre1940';
  }
  
  // 1940-1950: XX*XX o XX* (estrella como separador)
  if (/^[A-Z]{2}\*[A-Z]{2}$/.test(clean) || /^[A-Z]{2}\*[A-Z]{2}$/.test(clean)) {
    return 'historical_1940s';
  }
  if (/^[A-Z]{2}\*$/.test(clean)) {
    return 'historical_1940s';
  }
  
  // 1964-1995: Una letra + 6 o 7 números
  if (/^[A-Z]\d{6,7}$/.test(clean)) {
    return 'historical_1964';
  }
  
  // 1995-2007: LL·LL·NN
  if (/^[A-Z]{2}[A-Z]{2}\d{2}$/.test(clean)) {
    return 'historical_1995';
  }
  
  // VIGENTES: LLLL-NN (Autos) - 4 consonantes + 2 números
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{4}\d{2}$/.test(clean) && CONSONANTS_REGEX.test(clean.substring(0, 4))) {
    return 'current_auto';
  }
  
  // VIGENTES: LLL-NN (Motos) - 3 consonantes + 2 números
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{3}\d{2}$/.test(clean) && CONSONANTS_REGEX.test(clean.substring(0, 3))) {
    return 'current_moto';
  }
  
  // NUEVAS: LLLLL-N (Autos nuevo formato) - 5 consonantes + 1 número
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{5}\d{1}$/.test(clean)) {
    return 'new_auto';
  }
  
  // NUEVAS: LLLL-N (Motos nuevo formato) - 4 consonantes + 1 número
  if (/^[BCDFGHJKLMNPQRSTVWXYZ]{4}\d{1}$/.test(clean)) {
    return 'new_moto';
  }
  
  // ESPECIALES: Remolques (R o SR + números)
  if (/^R\d+$/.test(clean) || /^SR\d+$/.test(clean)) {
    return 'special_trailer';
  }
  
  // Si no coincide con ningún patrón, no es válido
  return null;
}

/**
 * Get human-readable description of patent type
 */
export function getPatentTypeDescription(type: PatentType): string {
  const descriptions: Record<PatentType, string> = {
    'historical_pre1940': 'Histórica (Pre-1940)',
    'historical_1940s': 'Histórica (1940-1950)',
    'historical_1964': 'Histórica (1964-1995)',
    'historical_1995': 'Histórica (1995-2007)',
    'current_auto': 'Automóvil vigente',
    'current_moto': 'Motocicleta vigente',
    'new_auto': 'Automóvil (nuevo formato)',
    'new_moto': 'Motocicleta (nuevo formato)',
    'special_green': 'Vehículo eléctrico/híbrido',
    'special_military': 'Ejército',
    'special_police': 'Carabineros',
    'special_firefighter': 'Bomberos',
    'special_trailer': 'Remolque',
  };
  return descriptions[type];
}

/**
 * Check if patent uses consonants only (excludes vowels to avoid words)
 */
export function isConsonant(c: string): boolean {
  return CONSONANTS.includes(c.toUpperCase());
}

/**
 * Chilean patent validation schema
 * Supports all historical and current formats
 */
export const patentSchema = z.string()
  .min(1, 'La patente es requerida')
  .transform((patent) => patent.toUpperCase().replace(/[\s.-]/g, ''))
  .refine(
    (patent) => {
      const type = detectPatentType(patent);
      return type !== null;
    },
    (patent) => {
      const type = detectPatentType(patent);
      if (type === null) {
        return {
          message: 'Formato de patente no válido. Ejemplos válidos: BBBB-00, ABCD-12, A123456',
        };
      }
      return { message: '' };
    }
  )
  .transform((patent) => {
    // Return the normalized patent
    return patent;
  });

export type PatentInput = z.input<typeof patentSchema>;
export type NormalizedPatent = z.output<typeof patentSchema>;

/**
 * Validates and normalizes a Chilean patent string.
 * Throws ZodError if invalid.
 */
export function normalizePatent(patent: PatentInput): NormalizedPatent {
  return patentSchema.parse(patent);
}

/**
 * Attempts to parse a Chilean patent, returning null if invalid.
 */
export function tryNormalizePatent(patent: PatentInput): NormalizedPatent | null {
  return patentSchema.safeParse(patent).success 
    ? patentSchema.parse(patent) 
    : null;
}

/**
 * Get patent type after normalization (returns null if invalid)
 */
export function getPatentType(patent: string): PatentType | null {
  return detectPatentType(patent);
}

/**
 * Check if a patent format is "current" (2007-present)
 */
export function isCurrentPatent(patent: string): boolean {
  const type = detectPatentType(patent);
  return type === 'current_auto' || type === 'current_moto';
}

/**
 * Check if a patent format is historical
 */
export function isHistoricalPatent(patent: string): boolean {
  const type = detectPatentType(patent);
  return type?.startsWith('historical_') ?? false;
}
