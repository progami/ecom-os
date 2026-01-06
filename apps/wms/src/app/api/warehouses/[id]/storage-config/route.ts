import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-wms'
import { z } from '@/lib/api'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  updates: z
    .array(
      z.object({
        skuId: z.string().uuid(),
        storageCartonsPerPallet: z.number().int().positive().nullable().optional(),
        shippingCartonsPerPallet: z.number().int().positive().nullable().optional(),
      })
    )
    .min(1),
})

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getTenantPrisma()
    const { id: warehouseId } = await context.params

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const skus = await prisma.sku.findMany({
      orderBy: { skuCode: 'asc' },
      select: {
        id: true,
        skuCode: true,
        description: true,
        warehouseStorageConfigs: {
          where: { warehouseId },
          select: {
            storageCartonsPerPallet: true,
            shippingCartonsPerPallet: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({
      warehouseId,
      storageConfigs: skus.map(sku => {
        const config = sku.warehouseStorageConfigs[0] ?? null
        return {
          skuId: sku.id,
          skuCode: sku.skuCode,
          description: sku.description,
          storageCartonsPerPallet: config?.storageCartonsPerPallet ?? null,
          shippingCartonsPerPallet: config?.shippingCartonsPerPallet ?? null,
          updatedAt: config?.updatedAt ? config.updatedAt.toISOString() : null,
        }
      }),
    })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin' && session.user.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prisma = await getTenantPrisma()
    const { id: warehouseId } = await context.params

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    await prisma.$transaction(async tx => {
      for (const update of parsed.data.updates) {
        const hasOwn = (key: keyof typeof update) =>
          Object.prototype.hasOwnProperty.call(update, key)

        const updateData: Prisma.WarehouseSkuStorageConfigUpdateInput = {}
        if (hasOwn('storageCartonsPerPallet')) {
          updateData.storageCartonsPerPallet = update.storageCartonsPerPallet ?? null
        }
        if (hasOwn('shippingCartonsPerPallet')) {
          updateData.shippingCartonsPerPallet = update.shippingCartonsPerPallet ?? null
        }

        await tx.warehouseSkuStorageConfig.upsert({
          where: {
            warehouseId_skuId: {
              warehouseId,
              skuId: update.skuId,
            },
          },
          create: {
            warehouseId,
            skuId: update.skuId,
            storageCartonsPerPallet: update.storageCartonsPerPallet ?? null,
            shippingCartonsPerPallet: update.shippingCartonsPerPallet ?? null,
          },
          update: updateData,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

