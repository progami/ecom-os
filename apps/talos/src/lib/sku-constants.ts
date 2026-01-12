/**
 * SKU field limits - must match Prisma schema constraints
 * @see prisma/schema.prisma - Sku model
 */
export const SKU_FIELD_LIMITS = {
  /** SKU code max length - matches skuCode unique constraint */
  SKU_CODE_MAX: 50,
  /** Description max length - matches @db.VarChar(255) */
  DESCRIPTION_MAX: 255,
  /** Description display truncation for tables */
  DESCRIPTION_DISPLAY_MAX: 64,
  /** ASIN max length */
  ASIN_MAX: 64,
  /** Category max length */
  CATEGORY_MAX: 255,
  /** Size tier max length */
  SIZE_TIER_MAX: 100,
} as const

/** Truncate text for table display */
export function truncateForDisplay(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}
