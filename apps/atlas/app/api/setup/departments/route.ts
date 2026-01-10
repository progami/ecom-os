import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'

/**
 * One-time setup endpoint to:
 * 1. Run department schema migration (add columns if missing)
 * 2. Seed department hierarchy with heads and KPIs
 *
 * SECURITY: Requires super-admin + SETUP_TOKEN env variable
 * This is safe to run multiple times - it uses upserts and IF NOT EXISTS
 */
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  // Security: Require SETUP_TOKEN environment variable
  const setupToken = process.env.SETUP_TOKEN
  if (!setupToken) {
    return NextResponse.json(
      { error: 'Setup endpoint disabled. Set SETUP_TOKEN env to enable.' },
      { status: 403 }
    )
  }

  // Verify token from Authorization header
  const authHeader = req.headers.get('authorization')
  const providedToken = authHeader?.replace('Bearer ', '')
  if (providedToken !== setupToken) {
    return NextResponse.json(
      { error: 'Invalid or missing setup token' },
      { status: 401 }
    )
  }

  // Security: Require super-admin
  const actorId = await getCurrentEmployeeId()
  if (!actorId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const isAdmin = await isSuperAdmin(actorId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const results: string[] = []

  try {
    // Step 1: Run migration SQL to add new columns
    results.push('Running schema migration...')

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "kpi" TEXT;
      `)
      results.push('Added kpi column')
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        results.push(`kpi column: ${e.message}`)
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headId" TEXT;
      `)
      results.push('Added headId column')
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        results.push(`headId column: ${e.message}`)
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
      `)
      results.push('Added parentId column')
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        results.push(`parentId column: ${e.message}`)
      }
    }

    // Add foreign keys (ignore if already exist)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Department"
        ADD CONSTRAINT "Department_headId_fkey"
        FOREIGN KEY ("headId") REFERENCES "Employee"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      `)
      results.push('Added headId foreign key')
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('headId foreign key already exists')
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Department"
        ADD CONSTRAINT "Department_parentId_fkey"
        FOREIGN KEY ("parentId") REFERENCES "Department"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      `)
      results.push('Added parentId foreign key')
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('parentId foreign key already exists')
      }
    }

    // Add indexes
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Department_headId_idx" ON "Department"("headId");
      `)
      results.push('Added headId index')
    } catch (e: any) {
      results.push(`headId index: ${e.message}`)
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");
      `)
      results.push('Added parentId index')
    } catch (e: any) {
      results.push(`parentId index: ${e.message}`)
    }

    results.push('Schema migration complete!')

    // Step 2: Seed department data
    results.push('\nSeeding departments...')

    // Get all employees to find heads
    const employees = await prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const findEmployee = (firstName: string) => {
      return employees.find((e: { id: string; firstName: string; lastName: string; email: string }) =>
        e.firstName.toLowerCase() === firstName.toLowerCase()
      )
    }

    // Find key people
    const jarrar = findEmployee('Jarrar')
    const mehdi = findEmployee('Mehdi')
    const hamad = findEmployee('Hamad')
    const zeeshan = findEmployee('Zeeshan')

    results.push(`Found employees: Jarrar=${!!jarrar}, Mehdi=${!!mehdi}, Hamad=${!!hamad}, Zeeshan=${!!zeeshan}`)

    // Create/update Targon LLC (root)
    const company = await prisma.department.upsert({
      where: { name: 'Targon LLC' },
      update: {
        kpi: 'Company performance',
        headId: jarrar?.id || null,
      },
      create: {
        name: 'Targon LLC',
        code: 'TARGON',
        kpi: 'Company performance',
        headId: jarrar?.id || null,
      },
    })
    results.push(`Upserted: Targon LLC (head: ${jarrar?.firstName || 'none'})`)

    // Executive Supervision (under Mehdi)
    await prisma.department.upsert({
      where: { name: 'Executive Supervision' },
      update: {
        kpi: 'Management cadence',
        headId: mehdi?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'Executive Supervision',
        code: 'EXEC',
        kpi: 'Management cadence',
        headId: mehdi?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: Executive Supervision (head: ${mehdi?.firstName || 'none'})`)

    // HR & Training (under Mehdi)
    await prisma.department.upsert({
      where: { name: 'HR & Training' },
      update: {
        kpi: 'People readiness',
        headId: mehdi?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'HR & Training',
        code: 'HR',
        kpi: 'People readiness',
        headId: mehdi?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: HR & Training (head: ${mehdi?.firstName || 'none'})`)

    // Operations (under Hamad)
    await prisma.department.upsert({
      where: { name: 'Operations' },
      update: {
        kpi: 'Process reliability',
        headId: hamad?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'Operations',
        code: 'OPS',
        kpi: 'Process reliability',
        headId: hamad?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: Operations (head: ${hamad?.firstName || 'none'})`)

    // Sales & Marketing (under Hamad)
    await prisma.department.upsert({
      where: { name: 'Sales & Marketing' },
      update: {
        kpi: 'Order volume',
        headId: hamad?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'Sales & Marketing',
        code: 'SALES',
        kpi: 'Order volume',
        headId: hamad?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: Sales & Marketing (head: ${hamad?.firstName || 'none'})`)

    // Finance (under Zeeshan)
    await prisma.department.upsert({
      where: { name: 'Finance' },
      update: {
        kpi: 'Cashflow management',
        headId: zeeshan?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'Finance',
        code: 'FIN',
        kpi: 'Cashflow management',
        headId: zeeshan?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: Finance (head: ${zeeshan?.firstName || 'none'})`)

    // Legal (under Zeeshan)
    await prisma.department.upsert({
      where: { name: 'Legal' },
      update: {
        kpi: 'Contracts & compliance',
        headId: zeeshan?.id || null,
        parentId: company.id,
      },
      create: {
        name: 'Legal',
        code: 'LEGAL',
        kpi: 'Contracts & compliance',
        headId: zeeshan?.id || null,
        parentId: company.id,
      },
    })
    results.push(`Upserted: Legal (head: ${zeeshan?.firstName || 'none'})`)

    // Link any orphan departments to company
    const existingDepts = await prisma.department.findMany()
    for (const dept of existingDepts) {
      if (!dept.parentId && dept.name !== 'Targon LLC') {
        await prisma.department.update({
          where: { id: dept.id },
          data: { parentId: company.id },
        })
        results.push(`Linked orphan department "${dept.name}" to Targon LLC`)
      }
    }

    results.push('\nDepartment seeding complete!')

    // Step 3: Set up reporting hierarchy
    results.push('\nSetting up reporting hierarchy...')

    // Jarrar is CEO - no manager
    // Mehdi, Hamad, Zeeshan report to Jarrar
    if (jarrar) {
      if (mehdi) {
        await prisma.employee.update({
          where: { id: mehdi.id },
          data: { reportsToId: jarrar.id },
        })
        results.push(`${mehdi.firstName} now reports to ${jarrar.firstName}`)
      }
      if (hamad) {
        await prisma.employee.update({
          where: { id: hamad.id },
          data: { reportsToId: jarrar.id },
        })
        results.push(`${hamad.firstName} now reports to ${jarrar.firstName}`)
      }
      if (zeeshan) {
        await prisma.employee.update({
          where: { id: zeeshan.id },
          data: { reportsToId: jarrar.id },
        })
        results.push(`${zeeshan.firstName} now reports to ${jarrar.firstName}`)
      }
    }

    // Umair reports to Hamad
    const umair = findEmployee('Umair')
    if (umair && hamad) {
      await prisma.employee.update({
        where: { id: umair.id },
        data: { reportsToId: hamad.id },
      })
      results.push(`${umair.firstName} now reports to ${hamad.firstName}`)
    }

    results.push('\nReporting hierarchy complete!')
    results.push('\n✅ All setup complete!')

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (e) {
    console.error('[Setup Departments] Error:', e)
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
      results,
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return NextResponse.json({
    message: 'POST to this endpoint to run department setup (migration + seed + hierarchy)',
    warning: 'This will modify the database',
  })
}
