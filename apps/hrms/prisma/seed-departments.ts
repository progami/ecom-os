/**
 * Seed script to set up department hierarchy with heads and KPIs
 * Based on Targon LLC organizational structure
 *
 * Run with: npx tsx prisma/seed-departments.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting department seed...')

  // First, get all employees to find heads
  const employees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  const findEmployee = (firstName: string) => {
    const emp = employees.find(e =>
      e.firstName.toLowerCase() === firstName.toLowerCase()
    )
    if (!emp) {
      console.warn(`Warning: Employee "${firstName}" not found`)
    }
    return emp
  }

  // Find key people
  const jarrar = findEmployee('Jarrar')
  const mehdi = findEmployee('Mehdi')
  const hamad = findEmployee('Hamad')
  const zeeshan = findEmployee('Zeeshan')
  const umair = findEmployee('Umair')

  // Upsert departments with hierarchy
  // Note: Department names must match what's in Employee.department field

  // Root level - Company
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
  console.log('Created/Updated: Targon LLC')

  // Executive Supervision (under Mehdi)
  const execSupervision = await prisma.department.upsert({
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
  console.log('Created/Updated: Executive Supervision')

  // HR & Training (under Mehdi)
  const hrTraining = await prisma.department.upsert({
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
  console.log('Created/Updated: HR & Training')

  // Operations (under Hamad)
  const operations = await prisma.department.upsert({
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
  console.log('Created/Updated: Operations')

  // Sales & Marketing (under Hamad)
  const salesMarketing = await prisma.department.upsert({
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
  console.log('Created/Updated: Sales & Marketing')

  // Finance (under Zeeshan)
  const finance = await prisma.department.upsert({
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
  console.log('Created/Updated: Finance')

  // Legal (under Zeeshan)
  const legal = await prisma.department.upsert({
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
  console.log('Created/Updated: Legal')

  // Also update any existing departments that may not have KPIs
  const existingDepts = await prisma.department.findMany()
  for (const dept of existingDepts) {
    if (!dept.parentId && dept.name !== 'Targon LLC') {
      // Link orphan departments to company
      await prisma.department.update({
        where: { id: dept.id },
        data: { parentId: company.id },
      })
      console.log(`Linked orphan department "${dept.name}" to Targon LLC`)
    }
  }

  console.log('\nDepartment seed completed!')
  console.log('Departments in hierarchy:')

  const allDepts = await prisma.department.findMany({
    include: {
      head: { select: { firstName: true, lastName: true } },
      parent: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  for (const dept of allDepts) {
    const head = dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : 'No head'
    const parent = dept.parent?.name || 'Root'
    console.log(`  - ${dept.name} (Head: ${head}, Parent: ${parent}, KPI: ${dept.kpi || 'None'})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
