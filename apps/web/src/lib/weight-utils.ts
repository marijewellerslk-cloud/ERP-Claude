/**
 * Sri Lankan Traditional Weight Conversion Utilities
 *
 * Traditional Units:
 * - 1 Sovereign = 8 grams
 * - 1 Manchadi = ~0.300 grams (300 milligrams)
 * - Fractions: 3/4 sov, 1/2 sov, 1/4 sov
 */

const SOVEREIGN_IN_GRAMS = 8;
const MANCHADI_IN_GRAMS = 0.3;

export interface TraditionalWeight {
  sovereigns: number;
  manchadis: number;
  remainingGrams: number;
  displayText: string;
  exactGrams: number;
}

/**
 * Convert grams to traditional Sri Lankan weight display
 * Examples:
 * - 2g = "1/4 Sovereign"
 * - 4g = "1/2 Sovereign"
 * - 6g = "3/4 Sovereign"
 * - 8.3g = "1 Sovereign 1 Manchadi"
 * - 12g = "1 1/2 Sovereigns"
 * - 12.900g = "1 1/2 Sovereigns 3 Manchadis"
 * - 14g = "1 3/4 Sovereigns"
 * - 14.900g = "1 3/4 Sovereigns 3 Manchadis"
 * - 15.7g = "2 Sovereigns minus 1 Manchadi"
 */
export function convertToTraditionalWeight(grams: number): TraditionalWeight {
  if (!grams || grams <= 0) {
    return {
      sovereigns: 0,
      manchadis: 0,
      remainingGrams: 0,
      displayText: '0g',
      exactGrams: 0,
    };
  }

  const exactGrams = grams;
  let displayText = '';
  const tolerance = 0.1;

  // Check for exact fractional sovereigns first (prioritize these)
  // 1/4 Sovereign (2g)
  if (Math.abs(grams - 2) < tolerance) {
    displayText = '1/4 Sovereign';
  }
  // 1/2 Sovereign (4g)
  else if (Math.abs(grams - 4) < tolerance) {
    displayText = '1/2 Sovereign';
  }
  // 3/4 Sovereign (6g)
  else if (Math.abs(grams - 6) < tolerance) {
    displayText = '3/4 Sovereign';
  }
  // Check for 1 1/2 Sovereigns (12g) and variations
  else if (Math.abs(grams - 12) < tolerance) {
    displayText = '1 1/2 Sovereigns';
  }
  // Check for 1 3/4 Sovereigns (14g) and variations
  else if (Math.abs(grams - 14) < tolerance) {
    displayText = '1 3/4 Sovereigns';
  }
  // Check for 2 1/2 Sovereigns (20g) and variations
  else if (Math.abs(grams - 20) < tolerance) {
    displayText = '2 1/2 Sovereigns';
  }
  // Check for 2 3/4 Sovereigns (22g) and variations
  else if (Math.abs(grams - 22) < tolerance) {
    displayText = '2 3/4 Sovereigns';
  }
  // Check if it's close to a fractional sovereign with manchadis
  else if (grams > 12 && grams < 16) {
    // Between 1 1/2 and 2 sovereigns
    const baseWeight = 12; // 1 1/2 sovereigns
    const remainingGrams = grams - baseWeight;
    const manchadis = Math.round(remainingGrams / MANCHADI_IN_GRAMS);

    if (manchadis > 0 && manchadis < 7) {
      // Close to 1 1/2 sovereigns with manchadis
      displayText = manchadis === 1
        ? '1 1/2 Sovereigns 1 Manchadi'
        : `1 1/2 Sovereigns ${manchadis} Manchadis`;
    } else if (Math.abs(grams - 14) < 0.5) {
      // Closer to 1 3/4 sovereigns
      const remaining14 = grams - 14;
      const manchadis14 = Math.round(remaining14 / MANCHADI_IN_GRAMS);
      if (manchadis14 > 0) {
        displayText = manchadis14 === 1
          ? '1 3/4 Sovereigns 1 Manchadi'
          : `1 3/4 Sovereigns ${manchadis14} Manchadis`;
      } else {
        displayText = '1 3/4 Sovereigns';
      }
    } else {
      displayText = manchadis === 1
        ? '1 1/2 Sovereigns 1 Manchadi'
        : `1 1/2 Sovereigns ${manchadis} Manchadis`;
    }
  }
  // Check if it's close to any full sovereign with 1/2 or 3/4
  else if (grams > 8) {
    const fullSovereigns = Math.floor(grams / SOVEREIGN_IN_GRAMS);
    const remaining = grams - (fullSovereigns * SOVEREIGN_IN_GRAMS);

    // Check if remaining is close to 1/2 sovereign (4g)
    if (Math.abs(remaining - 4) < tolerance) {
      displayText = `${fullSovereigns} 1/2 Sovereigns`;
    }
    // Check if remaining is close to 3/4 sovereign (6g)
    else if (Math.abs(remaining - 6) < tolerance) {
      displayText = `${fullSovereigns} 3/4 Sovereigns`;
    }
    // Check if remaining is close to 1/4 sovereign (2g)
    else if (Math.abs(remaining - 2) < tolerance) {
      displayText = `${fullSovereigns} 1/4 Sovereigns`;
    }
    // Check if it's "minus 1 manchadi" from next sovereign
    else if (Math.abs((fullSovereigns + 1) * SOVEREIGN_IN_GRAMS - grams - MANCHADI_IN_GRAMS) < tolerance) {
      const targetSovereigns = fullSovereigns + 1;
      displayText = targetSovereigns === 1
        ? '1 Sovereign minus 1 Manchadi'
        : `${targetSovereigns} Sovereigns minus 1 Manchadi`;
    }
    // Regular calculation with sovereigns and manchadis
    else {
      const manchadis = Math.round(remaining / MANCHADI_IN_GRAMS);
      const parts: string[] = [];

      if (fullSovereigns > 0) {
        parts.push(fullSovereigns === 1 ? '1 Sovereign' : `${fullSovereigns} Sovereigns`);
      }

      if (manchadis > 0) {
        parts.push(manchadis === 1 ? '1 Manchadi' : `${manchadis} Manchadis`);
      }

      displayText = parts.join(' ');
    }
  }
  // Less than 1 sovereign
  else {
    const fullSovereigns = Math.floor(grams / SOVEREIGN_IN_GRAMS);
    const remaining = grams - (fullSovereigns * SOVEREIGN_IN_GRAMS);
    const manchadis = Math.round(remaining / MANCHADI_IN_GRAMS);

    if (manchadis > 0) {
      displayText = manchadis === 1 ? '1 Manchadi' : `${manchadis} Manchadis`;
    } else {
      // Less than 1 manchadi, show exact grams
      displayText = `${grams.toFixed(3)}g`;
    }
  }

  const fullSovereigns = Math.floor(grams / SOVEREIGN_IN_GRAMS);
  const remaining = grams - (fullSovereigns * SOVEREIGN_IN_GRAMS);

  return {
    sovereigns: fullSovereigns,
    manchadis: Math.round(remaining / MANCHADI_IN_GRAMS),
    remainingGrams: remaining,
    displayText,
    exactGrams,
  };
}

/**
 * Format weight for display with both traditional and metric
 * Displays net weight first, then traditional method
 * Example: "8.600g Net (1 Sovereign 2 Manchadis)"
 */
export function formatWeight(grams: number, showTraditional: boolean = true): string {
  if (!showTraditional) {
    return `${grams.toFixed(3)}g`;
  }

  const traditional = convertToTraditionalWeight(grams);
  return `${grams.toFixed(3)}g Net (${traditional.displayText})`;
}

/**
 * Weight class definitions for filtering
 */
export const WEIGHT_CLASSES = [
  { label: '≤ 300mg (≤ 1 Manchadi)', min: 0, max: 0.3 },
  { label: '≤ 600mg (≤ 2 Manchadi)', min: 0.3, max: 0.6 },
  { label: '≤ 1g', min: 0.6, max: 1 },
  { label: '≤ 1.5g', min: 1, max: 1.5 },
  { label: '≤ 2g (≤ 1/4 Sovereign)', min: 1.5, max: 2 },
  { label: '≤ 3g', min: 2, max: 3 },
  { label: '≤ 4g (≤ 1/2 Sovereign)', min: 3, max: 4 },
  { label: '≤ 6g (≤ 3/4 Sovereign)', min: 4, max: 6 },
  { label: '≤ 8g (≤ 1 Sovereign)', min: 6, max: 8 },
  { label: '≤ 10g', min: 8, max: 10 },
  { label: '≤ 12g', min: 10, max: 12 },
  { label: '≤ 14g', min: 12, max: 14 },
  { label: '≤ 16g (≤ 2 Sovereigns)', min: 14, max: 16 },
  { label: '≤ 20g', min: 16, max: 20 },
  { label: '≤ 22g', min: 20, max: 22 },
  { label: '≤ 24g (≤ 3 Sovereigns)', min: 22, max: 24 },
  { label: '≤ 28g', min: 24, max: 28 },
  { label: '≤ 32g (≤ 4 Sovereigns)', min: 28, max: 32 },
  { label: '≤ 40g (≤ 5 Sovereigns)', min: 32, max: 40 },
  { label: '≤ 48g (≤ 6 Sovereigns)', min: 40, max: 48 },
  { label: '≤ 64g (≤ 8 Sovereigns)', min: 48, max: 64 },
  { label: '≤ 72g (≤ 9 Sovereigns)', min: 64, max: 72 },
  { label: '≤ 80g (≤ 10 Sovereigns)', min: 72, max: 80 },
  { label: '≤ 88g (≤ 11 Sovereigns)', min: 80, max: 88 },
  { label: '≤ 92g', min: 88, max: 92 },
  { label: '≤ 120g (≤ 15 Sovereigns)', min: 92, max: 120 },
  { label: '≤ 200g (≤ 25 Sovereigns)', min: 120, max: 200 },
  { label: '> 200g (> 25 Sovereigns)', min: 200, max: Infinity },
] as const;

/**
 * Get weight class label for a given weight
 */
export function getWeightClass(grams: number): string {
  const weightClass = WEIGHT_CLASSES.find(wc => grams > wc.min && grams <= wc.max);
  return weightClass?.label || '> 200g';
}
