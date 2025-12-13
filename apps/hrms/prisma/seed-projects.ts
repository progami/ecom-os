/**
 * Seed script to set up projects with leads and members
 *
 * Run with: npx tsx prisma/seed-projects.ts
 *
 * NOTE: Run the migration first:
 *   npx prisma migrate dev --name add_project_model
 */

import { PrismaClient } from '@ecom-os/prisma-hrms'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting project seed...')

  // First, get all employees to find leads and members
  const employees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  const findEmployee = (name: string) => {
    const emp = employees.find(e =>
      e.firstName.toLowerCase().includes(name.toLowerCase()) ||
      e.lastName.toLowerCase().includes(name.toLowerCase()) ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(name.toLowerCase())
    )
    if (!emp) {
      console.warn(`Warning: Employee "${name}" not found`)
    }
    return emp
  }

  // Find key people
  const mehdi = findEmployee('Mehdi')
  const hamad = findEmployee('Hamad')
  const imran = findEmployee('Imran Sharif') || findEmployee('Imran')
  const umair = findEmployee('Umair Afzal') || findEmployee('Umair')

  // Project 1: Dust Sheets (US) - under Mehdi
  const dustSheetsUS = await prisma.project.upsert({
    where: { name: 'Dust Sheets (US)' },
    update: {
      description: 'Dust Sheets product line - US Region',
      status: 'ACTIVE',
      leadId: mehdi?.id || null,
    },
    create: {
      name: 'Dust Sheets (US)',
      code: 'DS-US',
      description: 'Dust Sheets product line - US Region',
      status: 'ACTIVE',
      leadId: mehdi?.id || null,
    },
  })
  console.log(`Created/Updated: Dust Sheets (US) - Lead: ${mehdi ? `${mehdi.firstName} ${mehdi.lastName}` : 'None'}`)

  // Project 2: Dust Sheets (UK) - under Hamad
  const dustSheetsUK = await prisma.project.upsert({
    where: { name: 'Dust Sheets (UK)' },
    update: {
      description: 'Dust Sheets product line - UK Region',
      status: 'ACTIVE',
      leadId: hamad?.id || null,
    },
    create: {
      name: 'Dust Sheets (UK)',
      code: 'DS-UK',
      description: 'Dust Sheets product line - UK Region',
      status: 'ACTIVE',
      leadId: hamad?.id || null,
    },
  })
  console.log(`Created/Updated: Dust Sheets (UK) - Lead: ${hamad ? `${hamad.firstName} ${hamad.lastName}` : 'None'}`)

  // Project 3: Project X - Imran as PM, Umair Afzal as member
  const projectX = await prisma.project.upsert({
    where: { name: 'Project X' },
    update: {
      description: 'Project X',
      status: 'ACTIVE',
      leadId: imran?.id || null,
    },
    create: {
      name: 'Project X',
      code: 'PROJ-X',
      description: 'Project X',
      status: 'ACTIVE',
      leadId: imran?.id || null,
    },
  })
  console.log(`Created/Updated: Project X - Lead: ${imran ? `${imran.firstName} ${imran.lastName}` : 'None (Imran not found)'}`)

  // Add Umair Afzal as a member of Project X
  if (umair) {
    await prisma.projectMember.upsert({
      where: {
        projectId_employeeId: {
          projectId: projectX.id,
          employeeId: umair.id,
        },
      },
      update: {
        role: 'Team Member',
      },
      create: {
        projectId: projectX.id,
        employeeId: umair.id,
        role: 'Team Member',
      },
    })
    console.log(`Added ${umair.firstName} ${umair.lastName} as member of Project X`)
  }

  console.log('\nProject seed completed!')
  console.log('Projects created:')

  const allProjects = await prisma.project.findMany({
    include: {
      lead: { select: { firstName: true, lastName: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  })

  for (const proj of allProjects) {
    const lead = proj.lead ? `${proj.lead.firstName} ${proj.lead.lastName}` : 'No lead'
    console.log(`  - ${proj.name} (Lead: ${lead}, Members: ${proj._count.members}, Status: ${proj.status})`)
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
