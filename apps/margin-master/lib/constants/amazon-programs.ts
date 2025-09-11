/**
 * Amazon Program Constants
 * Maps program codes from the database to user-friendly display names
 */

export const AMAZON_PROGRAMS = {
  STANDARD: {
    code: 'STANDARD',
    displayName: 'Standard FBA',
    description: 'Amazon\'s standard fulfillment program',
    icon: '📦',
  },
  LOWPRICE: {
    code: 'LOWPRICE',
    displayName: 'Low-Price FBA',
    description: 'Fulfillment program for low-priced items',
    icon: '💰',
  },
  SIPP: {
    code: 'SIPP',
    displayName: 'Ships in Product Packaging',
    description: 'Products that ship in their own packaging without additional Amazon packaging',
    icon: '📮',
  },
  STORAGE: {
    code: 'STORAGE',
    displayName: 'Storage Fees',
    description: 'Monthly and long-term storage fees',
    icon: '🏪',
  },
  REFERRAL: {
    code: 'REFERRAL',
    displayName: 'Referral Fees',
    description: 'Category-based selling fees',
    icon: '💳',
  },
  LOWINVENTORYFEE: {
    code: 'LOWINVENTORYFEE',
    displayName: 'Low Inventory Level Fee',
    description: 'Fees for maintaining low inventory levels',
    icon: '📊',
  },
} as const;

export type ProgramCode = keyof typeof AMAZON_PROGRAMS;

/**
 * Get display name for a program code
 */
export function getProgramDisplayName(code: string): string {
  const program = AMAZON_PROGRAMS[code as ProgramCode];
  return program?.displayName || code;
}

/**
 * Get program info by code
 */
export function getProgramInfo(code: string) {
  return AMAZON_PROGRAMS[code as ProgramCode] || {
    code,
    displayName: code,
    description: '',
    icon: '📦',
  };
}

/**
 * Check if a program code is valid
 */
export function isValidProgramCode(code: string): code is ProgramCode {
  return code in AMAZON_PROGRAMS;
}

/**
 * Get all program codes
 */
export function getAllProgramCodes(): ProgramCode[] {
  return Object.keys(AMAZON_PROGRAMS) as ProgramCode[];
}

/**
 * Programs that are fee types (not actual fulfillment programs)
 */
export const FEE_TYPE_PROGRAMS = ['STORAGE', 'REFERRAL', 'LOWINVENTORYFEE'] as const;

/**
 * Programs that are fulfillment programs
 */
export const FULFILLMENT_PROGRAMS = ['STANDARD', 'LOWPRICE', 'SIPP'] as const;

/**
 * Check if a program is a fee type
 */
export function isFeeTypeProgram(code: string): boolean {
  return FEE_TYPE_PROGRAMS.includes(code as any);
}

/**
 * Check if a program is a fulfillment program
 */
export function isFulfillmentProgram(code: string): boolean {
  return FULFILLMENT_PROGRAMS.includes(code as any);
}