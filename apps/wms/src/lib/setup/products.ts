import { SetupClient, type SkuSeed, SetupClientError } from './setup-client'

export interface SeedProductsOptions {
  skipClean?: boolean
  logger?: (message: string) => void
  verboseLogger?: (message: string, data?: unknown) => void
  products?: readonly SkuSeed[]
}

const DEFAULT_PRODUCTS: readonly SkuSeed[] = [
  {
    skuCode: 'CS-008',
    description: 'Pack of 3 - LD',
    asin: 'B0C7ZQ3VZL',
    packSize: 3,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×1.2',
    unitWeightKg: 0.16,
    unitsPerCarton: 60,
    cartonDimensionsCm: '40×28×29.5',
    cartonWeightKg: 10,
    packagingType: 'Poly bag',
  },
  {
    skuCode: 'CS-010',
    description: 'Pack of 3 - ST',
    asin: 'B0CR1GSBQ9',
    packSize: 3,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×2',
    unitWeightKg: 0.41,
    unitsPerCarton: 52,
    cartonDimensionsCm: '41×28×39.5',
    cartonWeightKg: 21,
    packagingType: 'Poly bag',
  },
  {
    skuCode: 'CS-007',
    description: 'Pack of 6 - LD',
    asin: 'B09HXC3NL8',
    packSize: 6,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×2.3',
    unitWeightKg: 0.35,
    unitsPerCarton: 60,
    cartonDimensionsCm: '40×44×52.5',
    cartonWeightKg: 21.3,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-011',
    description: 'Pack of 6 - ST',
    asin: 'B0DHDTPGCP',
    packSize: 6,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×3.8',
    unitWeightKg: 0.84,
    unitsPerCarton: 24,
    cartonDimensionsCm: '41×26×51.5',
    cartonWeightKg: 20,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-009',
    description: 'Pack of 10 - LD',
    asin: 'B0CR1H3VSF',
    packSize: 10,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×3.8',
    unitWeightKg: 0.56,
    unitsPerCarton: 36,
    cartonDimensionsCm: '38×44×52.5',
    cartonWeightKg: 20.4,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-012',
    description: 'Pack of 10 - ST',
    asin: 'B0DHHCYZSH',
    packSize: 10,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×6.3',
    unitWeightKg: 1.36,
    unitsPerCarton: 16,
    cartonDimensionsCm: '44×27×51.5',
    cartonWeightKg: 22,
    packagingType: 'Box',
  },
] as const

export async function seedProducts(
  client: SetupClient,
  options: SeedProductsOptions = {}
): Promise<{ ensured: number; deleted: number }> {
  const {
    skipClean = false,
    logger,
    verboseLogger,
    products = DEFAULT_PRODUCTS,
  } = options

  const log = logger ?? (() => {})
  const verbose = verboseLogger ?? ((_message: string, _data?: unknown) => {})

  let deleted = 0

  if (!skipClean) {
    for (const product of products) {
      try {
        const existing = await client.findSkuByCode(product.skuCode)
        if (!existing) continue

        try {
          await client.deleteSku(existing.id)
          deleted += 1
          log(`Deleted existing SKU ${product.skuCode}`)
        } catch (error) {
          verbose(
            `Failed to delete SKU ${product.skuCode}, attempting update`,
            error instanceof Error ? error.message : error
          )
          await client.upsertSku(product)
          log(`Upserted SKU ${product.skuCode}`)
        }
      } catch (error) {
        verbose(
          `Unable to inspect SKU ${product.skuCode}`,
          error instanceof Error ? error.message : error
        )
      }
    }
  }

  for (const product of products) {
    try {
      await client.upsertSku(product)
      log(`Ensured SKU ${product.skuCode}`)
    } catch (error) {
      if (error instanceof SetupClientError) {
        verbose(
          `Failed to upsert SKU ${product.skuCode}`,
          error.details ?? error.message
        )
      }
      throw error
    }
  }

  return { ensured: products.length, deleted }
}

export { DEFAULT_PRODUCTS }
