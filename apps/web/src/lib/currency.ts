/**
 * Currency utility for Sri Lankan Rupees (LKR)
 * Provides consistent currency formatting across the application
 */

export const CURRENCY = {
  symbol: 'Rs',
  code: 'LKR',
  locale: 'en-LK', // Sri Lankan English locale (uses lakhs: 1,00,000 format)
};

/**
 * Format a number as Sri Lankan currency
 * @param amount - The amount to format (number or string)
 * @returns Formatted currency string (e.g., "Rs 1,00,000")
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return `${CURRENCY.symbol} 0`;
  }

  return `${CURRENCY.symbol} ${num.toLocaleString(CURRENCY.locale)}`;
}

/**
 * Format a number using Sri Lankan locale
 * @param amount - The amount to format
 * @returns Formatted number string (e.g., "1,00,000")
 */
export function formatNumber(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return '0';
  }

  return num.toLocaleString(CURRENCY.locale);
}

/**
 * Convert sovereign gold rate (8 grams) to per-gram rate
 * Used in Sri Lanka where gold is priced per sovereign
 * @param sovereignRate - Gold rate per sovereign (8g)
 * @returns Per-gram rate
 */
export function sovereignToPerGram(sovereignRate: number): number {
  return sovereignRate / 8;
}

/**
 * Convert per-gram gold rate to sovereign rate (8 grams)
 * @param perGramRate - Gold rate per gram
 * @returns Sovereign rate (8g)
 */
export function perGramToSovereign(perGramRate: number): number {
  return perGramRate * 8;
}
