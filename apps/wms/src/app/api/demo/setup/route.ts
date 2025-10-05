/*
 * Demo Setup Security Notes:
 * - Demo passwords should be set via environment variables in production
 * - Use DEMO_ADMIN_PASSWORD and DEMO_STAFF_PASSWORD environment variables
 * - If not set, fallback passwords are used (only acceptable in development)
 * - In production, always set these environment variables with strong passwords
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SetupClient } from '@/lib/setup/setup-client'
import { seedWarehouses } from '@/lib/setup/warehouse-configs'
import { seedProducts } from '@/lib/setup/products'
import { seedPurchaseOrders } from '@/lib/setup/purchase-orders'

export async function POST(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true'
    const existingDemoUser = await prisma.user.findFirst({
      where: { isDemo: true }
    })

    if (existingDemoUser && !force) {
      return NextResponse.json(
        {
          success: false,
          message: 'Demo environment already exists. Pass force=true to recreate.',
        },
        { status: 409 }
      )
    }

    if (force) {
      await cleanupDemoData()
    }

    const baseUrl = request.headers.get('origin')
      ?? request.nextUrl.origin
      ?? process.env.WMS_BASE_URL
      ?? process.env.BASE_URL
      ?? 'http://localhost:3001'

    const logger: string[] = []
    const appendLog = (message: string) => {
      logger.push(message)
    }

    const client = new SetupClient({ baseUrl })

    const { demoAdmin, staffUser } = await ensureDemoUsers(force)

    const warehouseResult = await seedWarehouses(client, {
      skipClean: !force,
      logger: (message) => appendLog(`[warehouses] ${message}`),
    })
    await seedProducts(client, {
      skipClean: !force,
      logger: (message) => appendLog(`[products] ${message}`),
    })
    const poResult = await seedPurchaseOrders(client, {
      logger: (message) => appendLog(`[purchase-orders] ${message}`),
    })

    return NextResponse.json({
      success: true,
      message: 'Demo environment set up successfully',
      summary: {
        demoAdmin: demoAdmin.email,
        staffUser: staffUser.email,
        warehouses: warehouseResult.warehouses.length,
        purchaseOrders: poResult.purchaseOrdersCreated,
        inboundTransactionCreated: poResult.inboundTransactionCreated,
        invoiceCreated: poResult.invoiceCreated,
        logs: logger,
      },
    })
  } catch (_error) {
    return NextResponse.json(
      { 
        error: 'Failed to set up demo environment',
        details: _error instanceof Error ? _error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
async function cleanupDemoData() {
  await prisma.costLedger.deleteMany({})
  await prisma.inventoryTransaction.deleteMany({})
  await prisma.purchaseOrderLine.deleteMany({})
  await prisma.purchaseOrder.deleteMany({})
  await prisma.costRate.deleteMany({})
  await prisma.user.deleteMany({ where: { isDemo: true } })
}

async function ensureDemoUsers(force: boolean) {
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD || 'SecureWarehouse2024!'
  const demoStaffPassword = process.env.DEMO_STAFF_PASSWORD || 'DemoStaff2024!'

  const hashedAdminPassword = await bcrypt.hash(demoAdminPassword, 10)
  const hashedStaffPassword = await bcrypt.hash(demoStaffPassword, 10)

  let demoAdmin = await prisma.user.findFirst({
    where: { username: 'demo-admin', isDemo: true },
  })

  if (!demoAdmin) {
    demoAdmin = await prisma.user.create({
      data: {
        username: 'demo-admin',
        email: 'demo-admin@warehouse.com',
        passwordHash: hashedAdminPassword,
        fullName: 'Demo Administrator',
        role: 'admin',
        isActive: true,
        isDemo: true,
      },
    })
  } else if (force) {
    await prisma.user.update({
      where: { id: demoAdmin.id },
      data: { passwordHash: hashedAdminPassword, isActive: true },
    })
  }

  let staffUser = await prisma.user.findFirst({
    where: { username: 'demo-staff', isDemo: true },
  })

  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        username: 'demo-staff',
        email: 'demo-staff@warehouse.com',
        passwordHash: hashedStaffPassword,
        fullName: 'Demo Staff',
        role: 'staff',
        isActive: true,
        isDemo: true,
      },
    })
  } else if (force) {
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { passwordHash: hashedStaffPassword, isActive: true },
    })
  }

  return { demoAdmin, staffUser }
}
