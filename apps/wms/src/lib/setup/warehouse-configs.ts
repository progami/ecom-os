import { SetupClient, type WarehouseSeed, SetupClientError, type RateSeed } from './setup-client'

export interface SeedWarehousesOptions {
  skipClean?: boolean
  logger?: (message: string) => void
  verboseLogger?: (message: string, data?: unknown) => void
  warehouses?: readonly WarehouseSeed[]
  rateBlueprint?: ReadonlyArray<Omit<RateSeed, 'warehouseId' | 'effectiveDate'>>
}

const DEFAULT_WAREHOUSES: readonly WarehouseSeed[] = [
  {
    code: 'FMC',
    name: 'FMC Primary Warehouse',
    address: '123 Logistics Way, New Jersey, USA',
  },
  {
    code: 'VGLOBAL',
    name: 'Vglobal Fulfilment Center',
    address: '456 Distribution Blvd, California, USA',
  },
] as const

const DEFAULT_RATE_BLUEPRINT: ReadonlyArray<Omit<RateSeed, 'warehouseId' | 'effectiveDate'>> = [
  {
    costName: 'Storage per pallet (monthly)',
    costCategory: 'Storage',
    costValue: 18,
    unitOfMeasure: 'PALLET_MONTH',
  },
  {
    costName: 'Inbound handling per pallet',
    costCategory: 'Accessorial',
    costValue: 8,
    unitOfMeasure: 'PALLET',
  },
]

export async function seedWarehouses(
  client: SetupClient,
  options: SeedWarehousesOptions = {}
): Promise<{ warehouses: Array<{ code: string; id: string }> }> {
  const {
    skipClean = false,
    logger,
    verboseLogger,
    warehouses: warehouseSeeds = DEFAULT_WAREHOUSES,
    rateBlueprint = DEFAULT_RATE_BLUEPRINT,
  } = options

  const log = logger ?? (() => {})
  const verbose = verboseLogger ?? ((_message: string, _data?: unknown) => {})

  const results: Array<{ code: string; id: string }> = []

  for (const seed of warehouseSeeds) {
    try {
      const record = await client.upsertWarehouse(seed)
      const id = record?.id ?? record?.warehouse?.id
      if (!id) {
        throw new Error(`Unable to resolve warehouse id for ${seed.code}`)
      }
      results.push({ code: seed.code, id })
      log(`Warehouse ensured: ${seed.code}`)
    } catch (error) {
      verbose(
        `Failed to upsert warehouse ${seed.code}`,
        error instanceof Error ? error.message : error
      )
      throw error
    }
  }

  const effectiveDate = new Date()
  effectiveDate.setUTCHours(0, 0, 0, 0)

  for (const warehouse of results) {
    for (const rate of rateBlueprint) {
      if (!skipClean) {
        await client.retireActiveRates(warehouse.id, rate.costName)
      }

      try {
        await client.createRate({
          warehouseId: warehouse.id,
          costCategory: rate.costCategory,
          costName: rate.costName,
          costValue: rate.costValue,
          unitOfMeasure: rate.unitOfMeasure,
          effectiveDate: effectiveDate.toISOString(),
        })
        log(`Rate ensured for ${warehouse.code}: ${rate.costName}`)
      } catch (error) {
        if (error instanceof SetupClientError && error.status === 400) {
          verbose(
            `Rate already exists for ${warehouse.code}: ${rate.costName}`,
            error.details ?? error.message
          )
          continue
        }
        verbose(
          `Failed to seed rate ${rate.costName} for ${warehouse.code}`,
          error instanceof Error ? error.message : error
        )
        throw error
      }
    }
  }

  return { warehouses: results }
}

export { DEFAULT_WAREHOUSES, DEFAULT_RATE_BLUEPRINT }
