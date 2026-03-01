/**
 * Metal Utility Functions for Jewellery Business
 *
 * Handles:
 * - Purity conversion and validation
 * - Fine metal equivalent calculations
 * - Complete pricing calculations (metal + making + tax)
 * - Wastage allowance validation
 * - Industry-standard calculations for gold, silver, and platinum
 */

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface MetalType {
  code: string;
  name: string;
  basePurity: number; // Reference purity for rate quotes
}

export interface PurityInfo {
  decimal: number;
  karat: number;
  millesimal: number;
  displayName: string;
  metalType: 'gold' | 'silver' | 'platinum' | 'unknown';
}

export interface PricingConfig {
  goldRatePerGram: number; // Rate for fine gold (999/24K)
  silverRatePerGram?: number;
  platinumRatePerGram?: number;
  gstPercent: number; // GST/VAT percentage (e.g., 3 for 3%)
  hallmarkPremiumPercent?: number; // Premium for hallmarked items
  includeGst?: boolean;
}

export interface MakingChargeConfig {
  type: 'percentage' | 'per_gram' | 'fixed';
  value: number;
  minCharge?: number; // Minimum making charge floor
  maxCharge?: number; // Maximum making charge cap
}

export interface JewelleryPriceBreakdown {
  metalValue: number;
  makingCharges: number;
  stoneValue: number;
  hallmarkPremium: number;
  subtotal: number;
  gstAmount: number;
  totalPrice: number;
  fineGoldEquivalent: number;
  effectiveMakingPercent: number;
}

export interface WastageAllowance {
  maxWastagePercent: number;
  description: string;
  typicalRange: { min: number; max: number };
  factors: string[];
}

export interface WastageValidationResult {
  isValid: boolean;
  maxAllowed: number;
  actualWastage: number;
  variance: number;
  severity: 'acceptable' | 'warning' | 'excessive';
  message: string;
  recommendations?: string[];
}

// =============================================================================
// METAL TYPE DEFINITIONS
// =============================================================================

export const METAL_TYPES: Record<string, MetalType> = {
  gold: { code: 'AU', name: 'Gold', basePurity: 0.999 },
  silver: { code: 'AG', name: 'Silver', basePurity: 0.999 },
  platinum: { code: 'PT', name: 'Platinum', basePurity: 0.950 },
};

// =============================================================================
// PURITY MAPPING - Industry Standard Values
// =============================================================================

/**
 * Precise purity values based on industry standards
 * Note: Karat to decimal is K/24, but actual hallmarked values may differ slightly
 */
const PURITY_MAP: Record<string, PurityInfo> = {
  // Gold - Karat Notation (K/24 calculation with hallmark adjustments)
  '24k': { decimal: 0.999, karat: 24, millesimal: 999, displayName: '24K (999)', metalType: 'gold' },
  '24kt': { decimal: 0.999, karat: 24, millesimal: 999, displayName: '24K (999)', metalType: 'gold' },
  '23k': { decimal: 0.9583, karat: 23, millesimal: 958, displayName: '23K (958)', metalType: 'gold' },
  '23kt': { decimal: 0.9583, karat: 23, millesimal: 958, displayName: '23K (958)', metalType: 'gold' },
  '22k': { decimal: 0.9166, karat: 22, millesimal: 916, displayName: '22K (916)', metalType: 'gold' },
  '22kt': { decimal: 0.9166, karat: 22, millesimal: 916, displayName: '22K (916)', metalType: 'gold' },
  '21k': { decimal: 0.875, karat: 21, millesimal: 875, displayName: '21K (875)', metalType: 'gold' },
  '21kt': { decimal: 0.875, karat: 21, millesimal: 875, displayName: '21K (875)', metalType: 'gold' },
  '20k': { decimal: 0.8333, karat: 20, millesimal: 833, displayName: '20K (833)', metalType: 'gold' },
  '20kt': { decimal: 0.8333, karat: 20, millesimal: 833, displayName: '20K (833)', metalType: 'gold' },
  '18k': { decimal: 0.750, karat: 18, millesimal: 750, displayName: '18K (750)', metalType: 'gold' },
  '18kt': { decimal: 0.750, karat: 18, millesimal: 750, displayName: '18K (750)', metalType: 'gold' },
  '14k': { decimal: 0.5833, karat: 14, millesimal: 583, displayName: '14K (583)', metalType: 'gold' },
  '14kt': { decimal: 0.5833, karat: 14, millesimal: 583, displayName: '14K (583)', metalType: 'gold' },
  '12k': { decimal: 0.500, karat: 12, millesimal: 500, displayName: '12K (500)', metalType: 'gold' },
  '12kt': { decimal: 0.500, karat: 12, millesimal: 500, displayName: '12K (500)', metalType: 'gold' },
  '10k': { decimal: 0.4166, karat: 10, millesimal: 416, displayName: '10K (416)', metalType: 'gold' },
  '10kt': { decimal: 0.4166, karat: 10, millesimal: 416, displayName: '10K (416)', metalType: 'gold' },
  '9k': { decimal: 0.375, karat: 9, millesimal: 375, displayName: '9K (375)', metalType: 'gold' },
  '9kt': { decimal: 0.375, karat: 9, millesimal: 375, displayName: '9K (375)', metalType: 'gold' },

  // Gold - Millesimal/Hallmark Notation
  '999': { decimal: 0.999, karat: 24, millesimal: 999, displayName: '24K (999)', metalType: 'gold' },
  '9999': { decimal: 0.9999, karat: 24, millesimal: 999.9, displayName: '24K (999.9)', metalType: 'gold' },
  '958': { decimal: 0.958, karat: 23, millesimal: 958, displayName: '23K (958)', metalType: 'gold' },
  '916': { decimal: 0.916, karat: 22, millesimal: 916, displayName: '22K (916)', metalType: 'gold' },
  '875': { decimal: 0.875, karat: 21, millesimal: 875, displayName: '21K (875)', metalType: 'gold' },
  '833': { decimal: 0.833, karat: 20, millesimal: 833, displayName: '20K (833)', metalType: 'gold' },
  '750': { decimal: 0.750, karat: 18, millesimal: 750, displayName: '18K (750)', metalType: 'gold' },
  '585': { decimal: 0.585, karat: 14, millesimal: 585, displayName: '14K (585)', metalType: 'gold' },
  '583': { decimal: 0.583, karat: 14, millesimal: 583, displayName: '14K (583)', metalType: 'gold' },
  '500': { decimal: 0.500, karat: 12, millesimal: 500, displayName: '12K (500)', metalType: 'gold' },
  '417': { decimal: 0.417, karat: 10, millesimal: 417, displayName: '10K (417)', metalType: 'gold' },
  '416': { decimal: 0.416, karat: 10, millesimal: 416, displayName: '10K (416)', metalType: 'gold' },
  '375': { decimal: 0.375, karat: 9, millesimal: 375, displayName: '9K (375)', metalType: 'gold' },

  // Silver
  '999s': { decimal: 0.999, karat: 0, millesimal: 999, displayName: 'Fine Silver (999)', metalType: 'silver' },
  '980': { decimal: 0.980, karat: 0, millesimal: 980, displayName: 'Silver (980)', metalType: 'silver' },
  '950s': { decimal: 0.950, karat: 0, millesimal: 950, displayName: 'Britannia Silver (950)', metalType: 'silver' },
  '925': { decimal: 0.925, karat: 0, millesimal: 925, displayName: 'Sterling Silver (925)', metalType: 'silver' },
  '900s': { decimal: 0.900, karat: 0, millesimal: 900, displayName: 'Coin Silver (900)', metalType: 'silver' },
  '800': { decimal: 0.800, karat: 0, millesimal: 800, displayName: 'Silver (800)', metalType: 'silver' },

  // Platinum
  '950pt': { decimal: 0.950, karat: 0, millesimal: 950, displayName: 'Platinum (950)', metalType: 'platinum' },
  '900pt': { decimal: 0.900, karat: 0, millesimal: 900, displayName: 'Platinum (900)', metalType: 'platinum' },
  '850pt': { decimal: 0.850, karat: 0, millesimal: 850, displayName: 'Platinum (850)', metalType: 'platinum' },
  'pt950': { decimal: 0.950, karat: 0, millesimal: 950, displayName: 'Platinum (950)', metalType: 'platinum' },
  'pt900': { decimal: 0.900, karat: 0, millesimal: 900, displayName: 'Platinum (900)', metalType: 'platinum' },
};

// =============================================================================
// WASTAGE ALLOWANCE MATRIX - Comprehensive Industry Standards
// =============================================================================

export const WASTAGE_ALLOWANCE_MATRIX: Record<string, WastageAllowance> = {
  // Chains and linked items - Higher wastage due to intricate work
  'chain': {
    maxWastagePercent: 4.0,
    description: 'Chains require precision soldering and linking',
    typicalRange: { min: 2.5, max: 4.0 },
    factors: ['link size', 'chain type', 'hollow vs solid'],
  },
  'rope_chain': {
    maxWastagePercent: 4.5,
    description: 'Rope chains have complex twisted construction',
    typicalRange: { min: 3.0, max: 4.5 },
    factors: ['twist density', 'thickness'],
  },
  'box_chain': {
    maxWastagePercent: 3.5,
    description: 'Box chains with square links',
    typicalRange: { min: 2.5, max: 3.5 },
    factors: ['link precision'],
  },

  // Earrings and small items
  'earring': {
    maxWastagePercent: 3.0,
    description: 'Small items with detailed work',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['design complexity', 'stone settings'],
  },
  'jhumka': {
    maxWastagePercent: 3.5,
    description: 'Traditional hanging earrings with dome shape',
    typicalRange: { min: 2.5, max: 3.5 },
    factors: ['filigree work', 'hanging elements'],
  },
  'stud': {
    maxWastagePercent: 2.5,
    description: 'Simple stud earrings',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['stone setting precision'],
  },
  'tops': {
    maxWastagePercent: 2.5,
    description: 'Ear tops/studs',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['design simplicity'],
  },

  // Nose ornaments
  'nose_pin': {
    maxWastagePercent: 3.0,
    description: 'Very small items requiring precision',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['tiny size', 'stone setting'],
  },
  'nose_ring': {
    maxWastagePercent: 2.5,
    description: 'Nose rings/hoops',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['wire forming'],
  },
  'nath': {
    maxWastagePercent: 4.0,
    description: 'Large traditional nose rings',
    typicalRange: { min: 3.0, max: 4.0 },
    factors: ['chain attachments', 'stone settings'],
  },

  // Pendants and lockets
  'pendant': {
    maxWastagePercent: 2.5,
    description: 'Medium complexity pendants',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['design intricacy', 'bail attachment'],
  },
  'locket': {
    maxWastagePercent: 3.0,
    description: 'Lockets with opening mechanism',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['hinge mechanism', 'closing clasp'],
  },
  'dollar': {
    maxWastagePercent: 2.5,
    description: 'Dollar/medallion pendants',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['engraving detail'],
  },

  // Rings
  'ring': {
    maxWastagePercent: 2.5,
    description: 'Standard ring manufacturing',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['band width', 'stone setting'],
  },
  'engagement_ring': {
    maxWastagePercent: 3.0,
    description: 'Rings with significant stone settings',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['prong settings', 'halo design'],
  },
  'band': {
    maxWastagePercent: 1.5,
    description: 'Simple wedding bands',
    typicalRange: { min: 1.0, max: 1.5 },
    factors: ['plain design'],
  },
  'cocktail_ring': {
    maxWastagePercent: 3.5,
    description: 'Large statement rings',
    typicalRange: { min: 2.5, max: 3.5 },
    factors: ['elaborate design', 'multiple stones'],
  },

  // Bangles
  'bangle': {
    maxWastagePercent: 2.0,
    description: 'Standard circular bangles',
    typicalRange: { min: 1.0, max: 2.0 },
    factors: ['hollow vs solid', 'finishing'],
  },
  'kada': {
    maxWastagePercent: 1.5,
    description: 'Heavy solid bangles',
    typicalRange: { min: 1.0, max: 1.5 },
    factors: ['solid construction'],
  },
  'churi': {
    maxWastagePercent: 2.0,
    description: 'Thin stacking bangles',
    typicalRange: { min: 1.5, max: 2.0 },
    factors: ['thin gauge work'],
  },
  'bangle_set': {
    maxWastagePercent: 2.5,
    description: 'Matched bangle sets',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['uniformity requirements'],
  },

  // Bracelets
  'bracelet': {
    maxWastagePercent: 2.5,
    description: 'Link bracelets',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['link work', 'clasp'],
  },
  'tennis_bracelet': {
    maxWastagePercent: 3.0,
    description: 'Stone-set line bracelets',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['multiple stone settings', 'flexibility'],
  },
  'cuff': {
    maxWastagePercent: 1.5,
    description: 'Solid cuff bracelets',
    typicalRange: { min: 1.0, max: 1.5 },
    factors: ['sheet forming'],
  },

  // Necklaces
  'necklace': {
    maxWastagePercent: 2.0,
    description: 'Standard necklaces',
    typicalRange: { min: 1.5, max: 2.0 },
    factors: ['length', 'clasp type'],
  },
  'choker': {
    maxWastagePercent: 2.5,
    description: 'Close-fitting necklaces',
    typicalRange: { min: 2.0, max: 2.5 },
    factors: ['rigid construction', 'multiple elements'],
  },
  'haar': {
    maxWastagePercent: 2.0,
    description: 'Long traditional necklaces',
    typicalRange: { min: 1.5, max: 2.0 },
    factors: ['length', 'bead stringing'],
  },
  'rani_haar': {
    maxWastagePercent: 2.5,
    description: 'Multi-strand long necklaces',
    typicalRange: { min: 2.0, max: 2.5 },
    factors: ['multiple strands', 'complex clasps'],
  },

  // Mangalsutra
  'mangalsutra': {
    maxWastagePercent: 2.5,
    description: 'Traditional wedding necklace with black beads',
    typicalRange: { min: 2.0, max: 2.5 },
    factors: ['bead integration', 'pendant attachment'],
  },

  // Anklets
  'anklet': {
    maxWastagePercent: 2.5,
    description: 'Ankle ornaments',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['chain or link type', 'charm attachments'],
  },
  'payal': {
    maxWastagePercent: 2.5,
    description: 'Traditional anklets with bells',
    typicalRange: { min: 2.0, max: 2.5 },
    factors: ['ghungroo attachments'],
  },
  'toe_ring': {
    maxWastagePercent: 2.5,
    description: 'Small toe rings',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['small size'],
  },

  // Sets and combinations
  'wedding_set': {
    maxWastagePercent: 2.0,
    description: 'Large coordinated wedding sets',
    typicalRange: { min: 1.5, max: 2.0 },
    factors: ['bulk processing', 'matching requirements'],
  },
  'bridal_set': {
    maxWastagePercent: 2.5,
    description: 'Complete bridal jewellery sets',
    typicalRange: { min: 2.0, max: 2.5 },
    factors: ['multiple piece coordination'],
  },

  // Coins and bars - Minimal wastage
  'coin': {
    maxWastagePercent: 0.5,
    description: 'Simple stamping/minting',
    typicalRange: { min: 0.2, max: 0.5 },
    factors: ['minimal processing'],
  },
  'bar': {
    maxWastagePercent: 0.3,
    description: 'Bullion bars with minimal processing',
    typicalRange: { min: 0.1, max: 0.3 },
    factors: ['simple casting'],
  },
  'biscuit': {
    maxWastagePercent: 0.3,
    description: 'Small gold biscuits',
    typicalRange: { min: 0.1, max: 0.3 },
    factors: ['simple casting'],
  },

  // Specialty items
  'filigree': {
    maxWastagePercent: 5.0,
    description: 'Intricate wire work designs',
    typicalRange: { min: 4.0, max: 5.0 },
    factors: ['fine wire work', 'soldering points'],
  },
  'temple_jewellery': {
    maxWastagePercent: 3.5,
    description: 'Traditional temple design jewellery',
    typicalRange: { min: 2.5, max: 3.5 },
    factors: ['antique finish', 'stone setting'],
  },
  'kundan': {
    maxWastagePercent: 3.0,
    description: 'Kundan setting work',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['lac filling', 'foil setting'],
  },
  'meenakari': {
    maxWastagePercent: 3.5,
    description: 'Enamel work jewellery',
    typicalRange: { min: 2.5, max: 3.5 },
    factors: ['enamel chambers', 'firing process'],
  },
  'polki': {
    maxWastagePercent: 3.0,
    description: 'Uncut diamond setting',
    typicalRange: { min: 2.0, max: 3.0 },
    factors: ['irregular stone shapes'],
  },

  // Watch accessories
  'watch_strap': {
    maxWastagePercent: 2.0,
    description: 'Gold watch straps',
    typicalRange: { min: 1.5, max: 2.0 },
    factors: ['link precision', 'clasp mechanism'],
  },
  'watch_case': {
    maxWastagePercent: 1.5,
    description: 'Watch case construction',
    typicalRange: { min: 1.0, max: 1.5 },
    factors: ['precision machining'],
  },

  // Default fallback
  'default': {
    maxWastagePercent: 2.5,
    description: 'Standard allowance for uncategorized items',
    typicalRange: { min: 1.5, max: 2.5 },
    factors: ['general manufacturing'],
  },
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate numeric input
 */
function validateNumber(value: number, fieldName: string, options?: {
  min?: number;
  max?: number;
  allowZero?: boolean;
}): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (!options?.allowZero && value <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }
  if (options?.min !== undefined && value < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}`);
  }
  if (options?.max !== undefined && value > options.max) {
    throw new Error(`${fieldName} must not exceed ${options.max}`);
  }
}

/**
 * Validate purity value
 */
function validatePurity(purity: number): void {
  if (purity <= 0 || purity > 1) {
    throw new Error('Purity must be between 0 and 1 (exclusive of 0, inclusive of 1)');
  }
}

// =============================================================================
// PURITY FUNCTIONS
// =============================================================================

/**
 * Parse purity string to decimal factor with improved handling
 * @param purity - Purity string like "22k", "916", "18kt", or numeric value
 * @param metalType - Optional metal type hint for disambiguation
 * @returns Decimal factor (0-1)
 */
export function parsePurity(
  purity: string | number | null | undefined,
  metalType?: 'gold' | 'silver' | 'platinum'
): number {
  if (purity === null || purity === undefined) return 0;

  // Handle numeric input directly
  if (typeof purity === 'number') {
    if (purity > 1 && purity <= 24) {
      // Karat value
      return purity / 24;
    }
    if (purity > 100 && purity <= 1000) {
      // Millesimal
      return purity / 1000;
    }
    if (purity > 1 && purity <= 100) {
      // Percentage
      return purity / 100;
    }
    if (purity > 0 && purity <= 1) {
      // Already decimal
      return purity;
    }
    return 0;
  }

  const input = String(purity);
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '');

  if (!normalized) return 0;

  // Check direct mapping first (most accurate)
  if (PURITY_MAP[normalized]) {
    return PURITY_MAP[normalized].decimal;
  }

  // Try with metal type suffix for disambiguation
  if (metalType === 'silver' && PURITY_MAP[normalized + 's']) {
    return PURITY_MAP[normalized + 's'].decimal;
  }
  if (metalType === 'platinum' && PURITY_MAP[normalized + 'pt']) {
    return PURITY_MAP[normalized + 'pt'].decimal;
  }

  // Check for karat notation patterns
  const karatMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:k|kt|karat|carat)$/i);
  if (karatMatch) {
    const karatValue = parseFloat(karatMatch[1]);
    if (karatValue > 0 && karatValue <= 24) {
      return karatValue / 24;
    }
  }

  // Extract numeric value for fallback parsing
  const numericStr = normalized.replace(/[^0-9.]/g, '');
  const numericValue = parseFloat(numericStr);

  if (!isNaN(numericValue) && numericValue > 0) {
    // Explicit karat indicator in string (even without 'k' suffix)
    if (normalized.includes('karat') || normalized.includes('carat')) {
      if (numericValue <= 24) {
        return numericValue / 24;
      }
    }

    // Three-digit millesimal (e.g., "916", "750", "585")
    if (numericValue >= 100 && numericValue <= 999 && Number.isInteger(numericValue)) {
      return numericValue / 1000;
    }

    // Four-digit millesimal (e.g., "9999" for 99.99%)
    if (numericValue >= 1000 && numericValue <= 9999 && Number.isInteger(numericValue)) {
      return numericValue / 10000;
    }

    // Karat interpretation for values 1-24 (only if metal is gold or unspecified)
    if (numericValue >= 1 && numericValue <= 24 && metalType !== 'silver' && metalType !== 'platinum') {
      return numericValue / 24;
    }

    // Percentage interpretation for values 25-100
    if (numericValue > 24 && numericValue <= 100) {
      return numericValue / 100;
    }

    // Decimal already (e.g., "0.916")
    if (numericValue > 0 && numericValue <= 1) {
      return numericValue;
    }
  }

  return 0;
}

/**
 * Get complete purity information
 * @param purity - Purity string or number
 * @param metalType - Metal type hint
 * @returns Complete purity information
 */
export function getPurityInfo(
  purity: string | number | null | undefined,
  metalType?: 'gold' | 'silver' | 'platinum'
): PurityInfo {
  const decimal = parsePurity(purity, metalType);

  if (decimal <= 0) {
    return {
      decimal: 0,
      karat: 0,
      millesimal: 0,
      displayName: 'Unknown',
      metalType: 'unknown',
    };
  }

  // Check if we have exact mapping
  if (typeof purity === 'string') {
    const normalized = purity.toLowerCase().trim().replace(/\s+/g, '');
    if (PURITY_MAP[normalized]) {
      return PURITY_MAP[normalized];
    }
  }

  // Calculate derived values
  const karat = Math.round(decimal * 24 * 10) / 10; // One decimal place
  const millesimal = Math.round(decimal * 1000);

  // Determine metal type
  let detectedMetalType: 'gold' | 'silver' | 'platinum' | 'unknown' = metalType || 'gold';
  if (typeof purity === 'string') {
    const lower = purity.toLowerCase();
    if (lower.includes('pt') || lower.includes('plat')) {
      detectedMetalType = 'platinum';
    } else if (lower.includes('s') && !lower.includes('k')) {
      detectedMetalType = 'silver';
    }
  }

  // Generate display name
  let displayName: string;
  if (detectedMetalType === 'gold' && decimal >= 0.375) {
    displayName = `${Math.round(karat)}K (${millesimal})`;
  } else if (detectedMetalType === 'silver') {
    displayName = `Silver (${millesimal})`;
  } else if (detectedMetalType === 'platinum') {
    displayName = `Platinum (${millesimal})`;
  } else {
    displayName = `${(decimal * 100).toFixed(1)}%`;
  }

  return {
    decimal,
    karat: detectedMetalType === 'gold' ? karat : 0,
    millesimal,
    displayName,
    metalType: detectedMetalType,
  };
}

/**
 * Get purity display name
 * @param purity - Purity string or number
 * @param metalType - Metal type hint
 * @returns Human-readable purity name
 */
export function getPurityDisplayName(
  purity: string | number | null | undefined,
  metalType?: 'gold' | 'silver' | 'platinum'
): string {
  return getPurityInfo(purity, metalType).displayName;
}

// =============================================================================
// FINE METAL CALCULATIONS
// =============================================================================

/**
 * Calculate fine metal equivalent (pure metal weight)
 * @param netWeight - Net weight in grams
 * @param purity - Purity string or decimal
 * @param metalType - Type of metal for rate determination
 * @returns Fine metal equivalent in grams (6 decimal places for precision)
 */
export function calculateFineMetalEquivalent(
  netWeight: number,
  purity: string | number | null | undefined,
  metalType: 'gold' | 'silver' | 'platinum' = 'gold'
): number {
  validateNumber(netWeight, 'Net weight', { allowZero: true });

  if (netWeight <= 0) return 0;

  const purityFactor = typeof purity === 'number' && purity > 0 && purity <= 1
    ? purity
    : parsePurity(purity, metalType);

  if (purityFactor <= 0) return 0;

  // 6 decimal places for precision in high-value transactions
  return Math.round(netWeight * purityFactor * 1000000) / 1000000;
}

// Alias for backward compatibility
export const calculateFineGoldEquivalent = calculateFineMetalEquivalent;

// =============================================================================
// METAL VALUE CALCULATIONS
// =============================================================================

/**
 * Calculate raw metal value at current rates
 * @param netWeight - Net weight in grams
 * @param purity - Purity string or decimal
 * @param ratePerGram - Rate per gram for fine (pure) metal
 * @param metalType - Type of metal
 * @returns Value in currency units (2 decimal places)
 */
export function calculateMetalValue(
  netWeight: number,
  purity: string | number | null | undefined,
  ratePerGram: number,
  metalType: 'gold' | 'silver' | 'platinum' = 'gold'
): number {
  validateNumber(netWeight, 'Net weight', { allowZero: true });
  validateNumber(ratePerGram, 'Rate per gram');

  const fineEquivalent = calculateFineMetalEquivalent(netWeight, purity, metalType);
  return Math.round(fineEquivalent * ratePerGram * 100) / 100;
}

// =============================================================================
// MAKING CHARGE CALCULATIONS
// =============================================================================

/**
 * Calculate making charges based on configuration
 * @param metalValue - Base metal value
 * @param netWeight - Net weight in grams
 * @param config - Making charge configuration
 * @returns Making charge amount
 */
export function calculateMakingCharges(
  metalValue: number,
  netWeight: number,
  config: MakingChargeConfig
): number {
  validateNumber(metalValue, 'Metal value', { allowZero: true });
  validateNumber(netWeight, 'Net weight', { allowZero: true });

  let makingCharge: number;

  switch (config.type) {
    case 'percentage':
      makingCharge = metalValue * (config.value / 100);
      break;
    case 'per_gram':
      makingCharge = netWeight * config.value;
      break;
    case 'fixed':
      makingCharge = config.value;
      break;
    default:
      makingCharge = 0;
  }

  // Apply min/max constraints
  if (config.minCharge !== undefined && makingCharge < config.minCharge) {
    makingCharge = config.minCharge;
  }
  if (config.maxCharge !== undefined && makingCharge > config.maxCharge) {
    makingCharge = config.maxCharge;
  }

  return Math.round(makingCharge * 100) / 100;
}

// =============================================================================
// COMPLETE JEWELLERY PRICING
// =============================================================================

/**
 * Calculate complete jewellery price with all components
 * @param params - All pricing parameters
 * @returns Complete price breakdown
 */
export function calculateJewelleryPrice(params: {
  netWeight: number;
  purity: string | number;
  metalType?: 'gold' | 'silver' | 'platinum';
  pricing: PricingConfig;
  makingCharge: MakingChargeConfig;
  stoneValue?: number;
  isHallmarked?: boolean;
}): JewelleryPriceBreakdown {
  const {
    netWeight,
    purity,
    metalType = 'gold',
    pricing,
    makingCharge,
    stoneValue = 0,
    isHallmarked = true,
  } = params;

  // Validate inputs
  validateNumber(netWeight, 'Net weight');
  validateNumber(pricing.goldRatePerGram, 'Gold rate');
  validateNumber(pricing.gstPercent, 'GST percent', { min: 0, max: 100, allowZero: true });

  // Get appropriate rate
  let ratePerGram: number;
  switch (metalType) {
    case 'silver':
      ratePerGram = pricing.silverRatePerGram || pricing.goldRatePerGram;
      break;
    case 'platinum':
      ratePerGram = pricing.platinumRatePerGram || pricing.goldRatePerGram;
      break;
    default:
      ratePerGram = pricing.goldRatePerGram;
  }

  // Calculate fine metal equivalent
  const fineMetalEquivalent = calculateFineMetalEquivalent(netWeight, purity, metalType);

  // Calculate metal value
  const metalValue = calculateMetalValue(netWeight, purity, ratePerGram, metalType);

  // Calculate making charges
  const makingCharges = calculateMakingCharges(metalValue, netWeight, makingCharge);

  // Calculate effective making charge percentage
  const effectiveMakingPercent = metalValue > 0 ? (makingCharges / metalValue) * 100 : 0;

  // Calculate hallmark premium
  let hallmarkPremium = 0;
  if (isHallmarked && pricing.hallmarkPremiumPercent && pricing.hallmarkPremiumPercent > 0) {
    hallmarkPremium = metalValue * (pricing.hallmarkPremiumPercent / 100);
  }

  // Calculate subtotal (before tax)
  const subtotal = metalValue + makingCharges + stoneValue + hallmarkPremium;

  // Calculate GST
  let gstAmount = 0;
  if (pricing.includeGst !== false && pricing.gstPercent > 0) {
    gstAmount = subtotal * (pricing.gstPercent / 100);
  }

  // Calculate total price
  const totalPrice = subtotal + gstAmount;

  return {
    metalValue: Math.round(metalValue * 100) / 100,
    makingCharges: Math.round(makingCharges * 100) / 100,
    stoneValue: Math.round(stoneValue * 100) / 100,
    hallmarkPremium: Math.round(hallmarkPremium * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    fineGoldEquivalent: fineMetalEquivalent,
    effectiveMakingPercent: Math.round(effectiveMakingPercent * 100) / 100,
  };
}

/**
 * Calculate selling price (simplified version)
 * @param netWeight - Net weight in grams
 * @param purity - Purity string or decimal
 * @param goldRate - Gold rate per gram (for fine gold)
 * @param makingChargePercent - Making charge as percentage of metal value
 * @param stoneValue - Value of stones (optional)
 * @param gstPercent - GST percentage (default 3%)
 * @returns Total selling price
 */
export function calculateSellingPrice(
  netWeight: number,
  purity: string | number,
  goldRate: number,
  makingChargePercent: number,
  stoneValue: number = 0,
  gstPercent: number = 3
): number {
  const breakdown = calculateJewelleryPrice({
    netWeight,
    purity,
    pricing: {
      goldRatePerGram: goldRate,
      gstPercent,
      includeGst: true,
    },
    makingCharge: {
      type: 'percentage',
      value: makingChargePercent,
    },
    stoneValue,
  });

  return breakdown.totalPrice;
}

// =============================================================================
// WASTAGE FUNCTIONS
// =============================================================================

/**
 * Get wastage allowance for a category with fuzzy matching
 * @param categoryName - Category name
 * @returns Wastage allowance details
 */
export function getWastageAllowance(categoryName: string): WastageAllowance {
  if (!categoryName) {
    return WASTAGE_ALLOWANCE_MATRIX['default'];
  }

  const normalized = categoryName.toLowerCase().trim().replace(/[\s-]+/g, '_');

  // Exact match
  if (WASTAGE_ALLOWANCE_MATRIX[normalized]) {
    return WASTAGE_ALLOWANCE_MATRIX[normalized];
  }

  // Priority-based partial matching (more specific first)
  const priorityMatches: Array<{ key: string; priority: number }> = [];

  for (const key of Object.keys(WASTAGE_ALLOWANCE_MATRIX)) {
    if (key === 'default') continue;

    // Exact substring match (category contains key)
    if (normalized.includes(key)) {
      priorityMatches.push({ key, priority: key.length * 2 }); // Higher priority for longer matches
    }
    // Key contains category
    else if (key.includes(normalized)) {
      priorityMatches.push({ key, priority: normalized.length });
    }
    // Word-based matching
    else {
      const normalizedWords = normalized.split('_');
      const keyWords = key.split('_');
      const commonWords = normalizedWords.filter(w => keyWords.includes(w));
      if (commonWords.length > 0) {
        priorityMatches.push({ key, priority: commonWords.join('').length });
      }
    }
  }

  // Sort by priority (highest first) and return best match
  if (priorityMatches.length > 0) {
    priorityMatches.sort((a, b) => b.priority - a.priority);
    return WASTAGE_ALLOWANCE_MATRIX[priorityMatches[0].key];
  }

  return WASTAGE_ALLOWANCE_MATRIX['default'];
}

/**
 * Validate wastage against allowance with detailed analysis
 * @param actualWastage - Actual wastage percentage
 * @param categoryName - Category name
 * @param designComplexity - Optional: 'simple' | 'medium' | 'complex' | 'intricate'
 * @returns Detailed validation result
 */
export function validateWastage(
  actualWastage: number,
  categoryName: string,
  designComplexity?: 'simple' | 'medium' | 'complex' | 'intricate'
): WastageValidationResult {
  validateNumber(actualWastage, 'Actual wastage', { min: 0, max: 100, allowZero: true });

  const allowance = getWastageAllowance(categoryName);

  // Adjust allowance based on design complexity
  let adjustedMax = allowance.maxWastagePercent;
  if (designComplexity) {
    const complexityMultipliers: Record<string, number> = {
      'simple': 0.8,
      'medium': 1.0,
      'complex': 1.15,
      'intricate': 1.3,
    };
    adjustedMax *= complexityMultipliers[designComplexity] || 1.0;
  }

  const variance = actualWastage - adjustedMax;
  const variancePercent = adjustedMax > 0 ? (variance / adjustedMax) * 100 : 0;

  // Determine severity
  let severity: 'acceptable' | 'warning' | 'excessive';
  if (actualWastage <= adjustedMax) {
    severity = 'acceptable';
  } else if (variancePercent <= 25) {
    severity = 'warning';
  } else {
    severity = 'excessive';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (severity === 'warning' || severity === 'excessive') {
    recommendations.push('Review manufacturing process for inefficiencies');
    recommendations.push('Check equipment calibration and maintenance');
    recommendations.push('Verify raw material quality');
    if (actualWastage > allowance.typicalRange.max * 1.5) {
      recommendations.push('Consider skill assessment for artisan');
      recommendations.push('Review scrap collection and recovery processes');
    }
  }

  // Generate message
  let message: string;
  if (severity === 'acceptable') {
    message = `Wastage ${actualWastage.toFixed(2)}% is within acceptable range (max ${adjustedMax.toFixed(2)}%)`;
  } else if (severity === 'warning') {
    message = `Wastage ${actualWastage.toFixed(2)}% slightly exceeds limit of ${adjustedMax.toFixed(2)}% for ${categoryName}`;
  } else {
    message = `Wastage ${actualWastage.toFixed(2)}% significantly exceeds limit of ${adjustedMax.toFixed(2)}% for ${categoryName}`;
  }

  return {
    isValid: severity === 'acceptable',
    maxAllowed: adjustedMax,
    actualWastage,
    variance: Math.round(variance * 100) / 100,
    severity,
    message,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

/**
 * Calculate expected wastage for an item
 * @param grossWeight - Gross weight before processing
 * @param finishedWeight - Finished weight after processing
 * @param scrapRecovered - Weight of recoverable scrap
 * @returns Wastage details
 */
export function calculateWastage(
  grossWeight: number,
  finishedWeight: number,
  scrapRecovered: number = 0
): {
  grossWastage: number;
  grossWastagePercent: number;
  netWastage: number;
  netWastagePercent: number;
  recoveryRate: number;
} {
  validateNumber(grossWeight, 'Gross weight');
  validateNumber(finishedWeight, 'Finished weight', { allowZero: true });
  validateNumber(scrapRecovered, 'Scrap recovered', { allowZero: true });

  if (finishedWeight > grossWeight) {
    throw new Error('Finished weight cannot exceed gross weight');
  }

  const grossWastage = grossWeight - finishedWeight;
  const grossWastagePercent = (grossWastage / grossWeight) * 100;
  const netWastage = grossWastage - scrapRecovered;
  const netWastagePercent = (netWastage / grossWeight) * 100;
  const recoveryRate = grossWastage > 0 ? (scrapRecovered / grossWastage) * 100 : 0;

  return {
    grossWastage: Math.round(grossWastage * 1000) / 1000,
    grossWastagePercent: Math.round(grossWastagePercent * 100) / 100,
    netWastage: Math.round(netWastage * 1000) / 1000,
    netWastagePercent: Math.round(netWastagePercent * 100) / 100,
    recoveryRate: Math.round(recoveryRate * 100) / 100,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert between purity notations
 * @param value - Input value
 * @param fromFormat - Source format
 * @param toFormat - Target format
 */
export function convertPurity(
  value: number,
  fromFormat: 'decimal' | 'karat' | 'millesimal' | 'percentage',
  toFormat: 'decimal' | 'karat' | 'millesimal' | 'percentage'
): number {
  // First convert to decimal
  let decimal: number;
  switch (fromFormat) {
    case 'karat':
      decimal = value / 24;
      break;
    case 'millesimal':
      decimal = value / 1000;
      break;
    case 'percentage':
      decimal = value / 100;
      break;
    default:
      decimal = value;
  }

  // Validate
  if (decimal <= 0 || decimal > 1) {
    throw new Error('Invalid purity value');
  }

  // Convert to target format
  switch (toFormat) {
    case 'karat':
      return Math.round(decimal * 24 * 100) / 100;
    case 'millesimal':
      return Math.round(decimal * 1000);
    case 'percentage':
      return Math.round(decimal * 10000) / 100;
    default:
      return decimal;
  }
}

/**
 * Get all supported purity values for a metal type
 */
export function getSupportedPurities(metalType: 'gold' | 'silver' | 'platinum'): PurityInfo[] {
  return Object.values(PURITY_MAP).filter(p => p.metalType === metalType);
}

/**
 * Check if a purity is standard/hallmarkable
 */
export function isStandardPurity(purity: string | number, metalType: 'gold' | 'silver' | 'platinum' = 'gold'): boolean {
  const decimal = parsePurity(purity, metalType);

  const standardPurities: Record<string, number[]> = {
    gold: [0.375, 0.417, 0.585, 0.750, 0.875, 0.916, 0.958, 0.999],
    silver: [0.800, 0.925, 0.950, 0.999],
    platinum: [0.850, 0.900, 0.950],
  };

  const tolerance = 0.005; // 0.5% tolerance
  return standardPurities[metalType].some(std => Math.abs(decimal - std) <= tolerance);
}
