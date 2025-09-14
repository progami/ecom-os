/*
 * Demo Setup Security Notes:
 * - Demo passwords should be set via environment variables in production
 * - Use DEMO_ADMIN_PASSWORD and DEMO_STAFF_PASSWORD environment variables
 * - If not set, fallback passwords are used (only acceptable in development)
 * - In production, always set these environment variables with strong passwords
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createDemoTransactions } from '@/lib/demo-transactions'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Disallow in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SETUP !== 'true') {
      return NextResponse.json({ error: 'Demo setup is disabled in production' }, { status: 403 })
    }

    // Require authenticated admin
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In production, require explicit strong passwords via env
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.DEMO_ADMIN_PASSWORD || !process.env.DEMO_STAFF_PASSWORD) {
        return NextResponse.json({ error: 'Missing required demo passwords' }, { status: 400 })
      }
    }
    // Check if demo users already exist
    const demoUser = await prisma.user.findFirst({
      where: {
        isDemo: true
      }
    })
    
    if (demoUser) {
      return NextResponse.json({
        success: false,
        message: 'Demo users already exist'
      })
    }

    // Start transaction to ensure atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Always create a demo admin user
      const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'SecureWarehouse2024!' : '')
      const hashedPassword = await bcrypt.hash(demoAdminPassword, 10)
      
      // Check if demo admin already exists
      let demoAdmin = await tx.user.findFirst({
        where: { 
          username: 'demo-admin',
          isDemo: true
        }
      })

      if (!demoAdmin) {
        demoAdmin = await tx.user.create({
          data: {
            username: 'demo-admin',
            email: 'demo-admin@warehouse.com',
            passwordHash: hashedPassword,
            fullName: 'Demo Administrator',
            role: 'admin',
            isActive: true,
            isDemo: true,
          }
        })
      }

      // Generate basic demo data (users, warehouses, SKUs, cost rates)
      const { warehouses, skus, staffUser } = await generateBasicDemoData(tx, demoAdmin.id)
      
      // Create demo transactions using the v0.5.0 schema
      const transactionResult = await createDemoTransactions({
        tx,
        adminUserId: demoAdmin.id,
        staffUserId: staffUser.id,
        warehouses,
        skus
      })
      
      return {
        demoAdmin,
        warehouses,
        skus,
        staffUser,
        transactionsCreated: transactionResult.transactions.length
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Demo environment set up successfully',
      transactionsCreated: result.transactionsCreated
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

async function generateBasicDemoData(tx: Prisma.TransactionClient, adminUserId: string) {
  // Create demo staff user
  const demoStaffPassword = process.env.DEMO_STAFF_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'DemoStaff2024!' : '')
  const hashedPassword = await bcrypt.hash(demoStaffPassword, 10)
  const staffUser = await tx.user.create({
    data: {
      username: 'demo-staff',
      email: 'demo-staff@warehouse.com',
      passwordHash: hashedPassword,
      fullName: 'Demo Staff',
      role: 'staff',
      isActive: true,
      isDemo: true,
    }
  })

  // Use existing warehouses or create if they don't exist
  let warehouses = await tx.warehouse.findMany({
    where: {
      code: {
        in: ['FMC', 'VGLOBAL']
      }
    }
  })
  
  // If warehouses don't exist, create them
  if (warehouses.length === 0) {
    warehouses = await Promise.all([
      tx.warehouse.create({
        data: {
          code: 'FMC',
          name: 'FMC Warehouse',
          address: '123 Warehouse St, London, UK',
          contactEmail: 'fmc@warehouse.com',
          contactPhone: '+44 20 1234 5678',
          isActive: true,
        }
      }),
      tx.warehouse.create({
        data: {
          code: 'VGLOBAL',
          name: 'Vglobal Distribution Center',
          address: '456 Industrial Park, Manchester, UK',
          contactEmail: 'vglobal@warehouse.com',
          contactPhone: '+44 161 234 5678',
          isActive: true,
        }
      }),
    ])
  }

  // Update staff user with warehouse assignment
  await tx.user.update({
    where: { id: staffUser.id },
    data: { warehouseId: warehouses[0].id }
  })

  // Use existing SKUs or create if they don't exist
  let skus = await tx.sku.findMany({
    where: {
      skuCode: {
        in: ['CS-007', 'CS-009', 'CS-011', 'CS-022', 'CS-023', 'CDS-001', 'CDS-002']
      }
    }
  })
  
  // If SKUs don't exist, create demo ones
  if (skus.length === 0) {
    skus = await Promise.all([
      tx.sku.create({
        data: {
          skuCode: 'CS-007',
          description: 'CS 007 Product',
          packSize: 1,
          unitDimensionsCm: '25x20.5x2.3',
          unitWeightKg: 0.15, // Estimated
          unitsPerCarton: 60,
          cartonDimensionsCm: '40x44x52.5',
          cartonWeightKg: 9.5, // Estimated based on units
          packagingType: 'Box',
          isActive: true,
        }
      }),
    tx.sku.create({
      data: {
        skuCode: 'CS-009',
        description: 'CS 009 Product',
        packSize: 1,
        unitDimensionsCm: '25x20.5x3.8',
        unitWeightKg: 0.25, // Estimated
        unitsPerCarton: 36,
        cartonDimensionsCm: '38x44x52.5',
        cartonWeightKg: 9.5, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    tx.sku.create({
      data: {
        skuCode: 'CS-011',
        description: 'CS 011 Product',
        packSize: 1,
        unitDimensionsCm: '25x20.5x3.8',
        unitWeightKg: 0.25, // Estimated
        unitsPerCarton: 52,
        cartonDimensionsCm: '41x28x39.5',
        cartonWeightKg: 13.5, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    tx.sku.create({
      data: {
        skuCode: 'CS-022',
        description: 'CS 022 Product',
        packSize: 1,
        unitDimensionsCm: '25x20.5x0.5',
        unitWeightKg: 0.05, // Estimated - thin product
        unitsPerCarton: 55,
        cartonDimensionsCm: '40x28x29.5',
        cartonWeightKg: 3.0, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    tx.sku.create({
      data: {
        skuCode: 'CS-023',
        description: 'CS 023 Product',
        packSize: 1,
        unitDimensionsCm: '25x20.5x4.0',
        unitWeightKg: 0.3, // Estimated
        unitsPerCarton: 32,
        cartonDimensionsCm: '38x44x52.5',
        cartonWeightKg: 10.0, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    tx.sku.create({
      data: {
        skuCode: 'CDS-001',
        description: 'CDS 001 Product',
        packSize: 1,
        unitDimensionsCm: '30x20x5',
        unitWeightKg: 0.4, // Estimated
        unitsPerCarton: 33,
        cartonDimensionsCm: '39.5x47.5x55',
        cartonWeightKg: 13.5, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    tx.sku.create({
      data: {
        skuCode: 'CDS-002',
        description: 'CDS 002 Product',
        packSize: 1,
        unitDimensionsCm: '32x22x10',
        unitWeightKg: 0.8, // Estimated - larger product
        unitsPerCarton: 14,
        cartonDimensionsCm: '32x60.5x52',
        cartonWeightKg: 12.0, // Estimated
        packagingType: 'Box',
        isActive: true,
      }
    }),
    ])
  }

  // Create demo cost rates only if they don't exist
  const costRates = await Promise.all([
    tx.costRate.create({
      data: {
        warehouseId: warehouses[0].id,
        costCategory: 'Storage',
        costName: 'Standard Storage - Per Pallet',
        costValue: 25.00,
        unitOfMeasure: 'pallet/week',
        effectiveDate: new Date('2024-01-01'),
        createdById: adminUserId,
      }
    }),
    tx.costRate.create({
      data: {
        warehouseId: warehouses[0].id,
        costCategory: 'Carton',
        costName: 'Inbound Processing',
        costValue: 1.50,
        unitOfMeasure: 'carton',
        effectiveDate: new Date('2024-01-01'),
        createdById: adminUserId,
      }
    }),
    tx.costRate.create({
      data: {
        warehouseId: warehouses[0].id,
        costCategory: 'Carton',
        costName: 'Outbound Processing',
        costValue: 1.75,
        unitOfMeasure: 'carton',
        effectiveDate: new Date('2024-01-01'),
        createdById: adminUserId,
      }
    }),
    tx.costRate.create({
      data: {
        warehouseId: warehouses[1].id,
        costCategory: 'Storage',
        costName: 'Standard Storage - Per Pallet',
        costValue: 20.00,
        unitOfMeasure: 'pallet/week',
        effectiveDate: new Date('2024-01-01'),
        createdById: adminUserId,
      }
    }),
  ])

  // Return basic entities for enhanced demo data generation
  return { warehouses, skus, staffUser, costRates }
}
