import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CostCategory } from '@ecom-os/prisma-wms'

export const dynamic = 'force-dynamic'

// Tactical Logistics CWH Rate Sheet (verified against invoices)
const RATE_TEMPLATES = [
  // INBOUND
  { costName: "20' Container Handling", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 650 },
  { costName: "40' Container Handling", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 825 },
  { costName: "40' HQ Container Handling", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 875 },
  { costName: "45' HQ Container Handling", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 950 },
  { costName: "LCL Handling", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_carton', defaultValue: 0.95 },
  { costName: "Additional SKU Fee", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_sku', defaultValue: 10 },
  { costName: "Cartons Over 1200", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_carton', defaultValue: 0.05 },
  { costName: "Pallet & Shrink Wrap Fee", costCategory: 'Inbound' as CostCategory, unitOfMeasure: 'per_pallet', defaultValue: 13.75 },
  // STORAGE
  { costName: "Warehouse Storage", costCategory: 'Storage' as CostCategory, unitOfMeasure: 'per_pallet_day', defaultValue: 0.69 },
  { costName: "Warehouse Storage (6+ Months)", costCategory: 'Storage' as CostCategory, unitOfMeasure: 'per_pallet_day', defaultValue: 0.69 },
  // OUTBOUND
  { costName: "Replenishment Handling", costCategory: 'Outbound' as CostCategory, unitOfMeasure: 'per_carton', defaultValue: 1.00 },
  { costName: "Replenishment Minimum", costCategory: 'Outbound' as CostCategory, unitOfMeasure: 'per_shipment', defaultValue: 15 },
  { costName: "FBA Trucking - Up to 8 Pallets", costCategory: 'Outbound' as CostCategory, unitOfMeasure: 'flat', defaultValue: 0 },
  { costName: "FBA Trucking - 9-12 Pallets", costCategory: 'Outbound' as CostCategory, unitOfMeasure: 'flat', defaultValue: 0 },
  { costName: "FBA Trucking - 13-28 Pallets (FTL)", costCategory: 'Outbound' as CostCategory, unitOfMeasure: 'flat', defaultValue: 0 },
  // FORWARDING
  { costName: "Pre-pull", costCategory: 'Forwarding' as CostCategory, unitOfMeasure: 'flat', defaultValue: 175 },
  { costName: "Pierpass 20'", costCategory: 'Forwarding' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 34.52 },
  { costName: "Pierpass 40'", costCategory: 'Forwarding' as CostCategory, unitOfMeasure: 'per_container', defaultValue: 68.42 },
]

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: warehouseId } = await context.params

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId }
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Get or create user for audit trail
    const email = session.user.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Missing user email' }, { status: 400 })
    }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username: email,
          fullName: session.user.name || email,
          role: 'admin',
          passwordHash: 'sso-placeholder',
          isActive: true,
        }
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get existing rates for this warehouse
    const existingRates = await prisma.costRate.findMany({
      where: { warehouseId },
      select: { id: true, costName: true, isActive: true }
    })

    const existingRateNames = new Set(existingRates.map(r => r.costName))
    const templateRateNames = new Set(RATE_TEMPLATES.map(t => t.costName))

    // Deactivate rates that are not in templates (lingering/useless)
    const ratesToDeactivate = existingRates.filter(r => !templateRateNames.has(r.costName) && r.isActive)

    // Create missing rates
    const ratesToCreate = RATE_TEMPLATES.filter(t => !existingRateNames.has(t.costName))

    // Update existing rates to ensure correct values
    const ratesToUpdate = existingRates.filter(r => templateRateNames.has(r.costName))

    const results = {
      deactivated: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    }

    // Deactivate lingering rates
    if (ratesToDeactivate.length > 0) {
      await prisma.costRate.updateMany({
        where: { id: { in: ratesToDeactivate.map(r => r.id) } },
        data: { isActive: false }
      })
      results.deactivated = ratesToDeactivate.length
    }

    // Create missing rates
    for (const template of ratesToCreate) {
      await prisma.costRate.create({
        data: {
          warehouseId,
          costCategory: template.costCategory,
          costName: template.costName,
          costValue: template.defaultValue,
          unitOfMeasure: template.unitOfMeasure,
          effectiveDate: today,
          isActive: true,
          createdById: user.id,
        }
      })
      results.created++
    }

    // Update existing rates with correct values
    for (const existingRate of ratesToUpdate) {
      const template = RATE_TEMPLATES.find(t => t.costName === existingRate.costName)
      if (template) {
        await prisma.costRate.update({
          where: { id: existingRate.id },
          data: {
            costCategory: template.costCategory,
            costValue: template.defaultValue,
            unitOfMeasure: template.unitOfMeasure,
            isActive: true,
          }
        })
        results.updated++
      }
    }

    return NextResponse.json({
      success: true,
      warehouseId,
      warehouseName: warehouse.name,
      results,
      message: `Initialized ${results.created} new rates, updated ${results.updated} existing rates, deactivated ${results.deactivated} lingering rates`
    })
  } catch (error) {
    console.error('Error initializing rates:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize rates' },
      { status: 500 }
    )
  }
}
