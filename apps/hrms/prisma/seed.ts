/* eslint-disable no-console */
import { PrismaClient, Region, LeaveType, LeavePolicyStatus } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

type EmployeeInput = {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  department: string
  position: string
  employmentType?: string
  joinDate: string
  status?: string
  region?: string
}

type ResourceInput = {
  name: string
  category: string
  subcategory?: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  rating?: number | null
}

// Leave policy entitlements per region
const LEAVE_POLICIES = [
  // Kansas (USA) policies
  {
    region: 'KANSAS_US' as Region,
    leaveType: 'PTO' as LeaveType,
    title: 'PTO - Kansas',
    description: 'Paid Time Off for vacation, sick leave, and personal days',
    entitledDays: 15,
    isPaid: true,
    carryoverMax: 5,
    minNoticeDays: 7,
    maxConsecutive: 10,
  },
  {
    region: 'KANSAS_US' as Region,
    leaveType: 'PARENTAL' as LeaveType,
    title: 'Parental Leave - Kansas',
    description: 'Maternity/Paternity leave for new parents',
    entitledDays: 12, // 12 weeks FMLA
    isPaid: false, // FMLA is unpaid
    carryoverMax: null,
    minNoticeDays: 30,
    maxConsecutive: null,
  },
  {
    region: 'KANSAS_US' as Region,
    leaveType: 'BEREAVEMENT_IMMEDIATE' as LeaveType,
    title: 'Bereavement (Immediate Family) - Kansas',
    description: 'Leave for death of immediate family member (spouse, child, parent, sibling)',
    entitledDays: 5,
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
  {
    region: 'KANSAS_US' as Region,
    leaveType: 'BEREAVEMENT_EXTENDED' as LeaveType,
    title: 'Bereavement (Extended Family) - Kansas',
    description: 'Leave for death of extended family member (grandparent, in-law, etc.)',
    entitledDays: 3,
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
  {
    region: 'KANSAS_US' as Region,
    leaveType: 'JURY_DUTY' as LeaveType,
    title: 'Jury Duty - Kansas',
    description: 'Leave for jury duty service',
    entitledDays: 10,
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
  // Pakistan policies
  {
    region: 'PAKISTAN' as Region,
    leaveType: 'PTO' as LeaveType,
    title: 'PTO - Pakistan',
    description: 'Annual leave and casual leave combined',
    entitledDays: 24, // 14 annual + 10 casual typical
    isPaid: true,
    carryoverMax: 14,
    minNoticeDays: 3,
    maxConsecutive: 14,
  },
  {
    region: 'PAKISTAN' as Region,
    leaveType: 'PARENTAL' as LeaveType,
    title: 'Parental Leave - Pakistan',
    description: 'Maternity leave (90 days for women, paternity varies)',
    entitledDays: 90, // 90 days maternity
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 30,
    maxConsecutive: null,
  },
  {
    region: 'PAKISTAN' as Region,
    leaveType: 'BEREAVEMENT_IMMEDIATE' as LeaveType,
    title: 'Bereavement (Immediate Family) - Pakistan',
    description: 'Leave for death of immediate family member',
    entitledDays: 7, // Iddat consideration
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
  {
    region: 'PAKISTAN' as Region,
    leaveType: 'BEREAVEMENT_EXTENDED' as LeaveType,
    title: 'Bereavement (Extended Family) - Pakistan',
    description: 'Leave for death of extended family member',
    entitledDays: 3,
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
  {
    region: 'PAKISTAN' as Region,
    leaveType: 'JURY_DUTY' as LeaveType,
    title: 'Court Duty - Pakistan',
    description: 'Leave for court appearances and legal obligations',
    entitledDays: 5,
    isPaid: true,
    carryoverMax: null,
    minNoticeDays: 0,
    maxConsecutive: null,
  },
]

function readJSON<T>(rel: string): T | null {
  const p = path.join(process.cwd(), rel)
  if (!fs.existsSync(p)) return null
  const raw = fs.readFileSync(p, 'utf8')
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    console.warn(`Could not parse ${rel}:`, e)
    return null
  }
}

async function seedEmployees() {
  const list = readJSON<EmployeeInput[]>('prisma/seed/employees.json')
    || readJSON<EmployeeInput[]>('prisma/seed/employees.sample.json')
  if (!list?.length) {
    console.log('No employees to seed')
    return
  }
  let ok = 0
  for (const e of list) {
    try {
      const regionValue = e.region?.toUpperCase() === 'PAKISTAN' ? 'PAKISTAN' : 'KANSAS_US'
      const data = {
        employeeId: String(e.employeeId),
        firstName: String(e.firstName),
        lastName: String(e.lastName),
        email: String(e.email),
        phone: e.phone ?? null,
        department: String((e as any).department || (e as any).departmentName || 'General'),
        position: String(e.position),
        employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as any,
        joinDate: new Date(e.joinDate),
        status: String(e.status || 'ACTIVE').toUpperCase() as any,
        region: regionValue as Region,
      }
      // Upsert by unique email (or employeeId fallback)
      await prisma.employee.upsert({
        where: { email: data.email },
        update: data,
        create: {
          ...data,
          dept: { connectOrCreate: { where: { name: data.department }, create: { name: data.department } } }
        },
      })
      ok++
    } catch (err) {
      // Fallback: try upsert by employeeId unique
      try {
        const regionValue = e.region?.toUpperCase() === 'PAKISTAN' ? 'PAKISTAN' : 'KANSAS_US'
        await prisma.employee.upsert({
          where: { employeeId: String(e.employeeId) },
          update: {
            firstName: String(e.firstName),
            lastName: String(e.lastName),
            email: String(e.email),
            phone: e.phone ?? null,
            department: String((e as any).department || (e as any).departmentName || 'General'),
            position: String(e.position),
            employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as any,
            joinDate: new Date(e.joinDate),
            status: String(e.status || 'ACTIVE').toUpperCase() as any,
            region: regionValue as Region,
          },
          create: {
            employeeId: String(e.employeeId),
            firstName: String(e.firstName),
            lastName: String(e.lastName),
            email: String(e.email),
            phone: e.phone ?? null,
            department: String((e as any).department || (e as any).departmentName || 'General'),
            position: String(e.position),
            employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as any,
            joinDate: new Date(e.joinDate),
            status: String(e.status || 'ACTIVE').toUpperCase() as any,
            region: regionValue as Region,
            dept: { connectOrCreate: { where: { name: String((e as any).department || (e as any).departmentName || 'General') }, create: { name: String((e as any).department || (e as any).departmentName || 'General') } } }
          }
        })
        ok++
      } catch (e2) {
        console.warn('Employee seed skipped:', e, e2)
      }
    }
  }
  console.log(`Seeded employees: ${ok}`)
}

async function seedResources() {
  const list = readJSON<ResourceInput[]>('prisma/seed/resources.json')
    || readJSON<ResourceInput[]>('prisma/seed/resources.sample.json')
  if (!list?.length) {
    console.log('No resources to seed')
    return
  }
  let ok = 0
  for (const r of list) {
    try {
      if (r.website) {
        const existing = await prisma.resource.findFirst({ where: { website: r.website } })
        if (existing) {
          await prisma.resource.update({ where: { id: existing.id }, data: {
            name: r.name,
            category: String(r.category).toUpperCase() as any,
            subcategory: r.subcategory ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            website: r.website ?? null,
            description: r.description ?? null,
            rating: r.rating ?? null,
          } })
          ok++
          continue
        }
      }
      await prisma.resource.create({ data: {
        name: r.name,
        category: String(r.category).toUpperCase() as any,
        subcategory: r.subcategory ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        website: r.website ?? null,
        description: r.description ?? null,
        rating: r.rating ?? null,
      } })
      ok++
    } catch (e) {
      console.warn('Resource seed skipped:', r.name, e)
    }
  }
  console.log(`Seeded resources: ${ok}`)
}

async function seedLeavePolicies() {
  console.log('Seeding leave policies...')
  let ok = 0
  for (const p of LEAVE_POLICIES) {
    try {
      await prisma.leavePolicy.upsert({
        where: {
          region_leaveType: {
            region: p.region,
            leaveType: p.leaveType,
          },
        },
        update: {
          title: p.title,
          description: p.description,
          entitledDays: p.entitledDays,
          isPaid: p.isPaid,
          carryoverMax: p.carryoverMax,
          minNoticeDays: p.minNoticeDays,
          maxConsecutive: p.maxConsecutive,
          status: 'ACTIVE' as LeavePolicyStatus,
        },
        create: {
          region: p.region,
          leaveType: p.leaveType,
          title: p.title,
          description: p.description,
          entitledDays: p.entitledDays,
          isPaid: p.isPaid,
          carryoverMax: p.carryoverMax,
          minNoticeDays: p.minNoticeDays,
          maxConsecutive: p.maxConsecutive,
          status: 'ACTIVE' as LeavePolicyStatus,
        },
      })
      ok++
    } catch (e) {
      console.warn('Leave policy seed skipped:', p.title, e)
    }
  }
  console.log(`Seeded leave policies: ${ok}`)
}

// Create leave balances for all employees for current year
async function seedLeaveBalances() {
  console.log('Seeding leave balances for current year...')
  const currentYear = new Date().getFullYear()

  // Get all active employees
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, region: true },
  })

  // Get all active leave policies
  const policies = await prisma.leavePolicy.findMany({
    where: { status: 'ACTIVE' },
  })

  let ok = 0
  for (const emp of employees) {
    // Get policies for this employee's region
    const regionPolicies = policies.filter(p => p.region === emp.region)

    for (const policy of regionPolicies) {
      try {
        await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveType_year: {
              employeeId: emp.id,
              leaveType: policy.leaveType,
              year: currentYear,
            },
          },
          update: {
            entitled: policy.entitledDays,
          },
          create: {
            employeeId: emp.id,
            leaveType: policy.leaveType,
            year: currentYear,
            entitled: policy.entitledDays,
            used: 0,
            carryover: 0,
            adjustment: 0,
          },
        })
        ok++
      } catch (e) {
        console.warn(`Leave balance seed skipped for employee ${emp.id}, ${policy.leaveType}:`, e)
      }
    }
  }
  console.log(`Seeded leave balances: ${ok}`)
}

async function main() {
  await seedEmployees()
  await seedResources()
  await seedLeavePolicies()
  await seedLeaveBalances()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
