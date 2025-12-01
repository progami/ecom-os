/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { EmploymentType, EmployeeStatus, HRMSPrismaClient } from '@/lib/hrms-prisma-types'
import { Pool } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const connectionString = process.env.DATABASE_URL || 'postgresql://hrms:hrms@localhost:5432/hrms?schema=public'
const url = new URL(connectionString)
const schema = url.searchParams.get('schema') || undefined
const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase()
const ssl =
  sslMode === 'disable'
    ? undefined
    : {
        rejectUnauthorized: sslMode !== 'no-verify',
      }

const pool = new Pool({ connectionString, ssl })

if (schema) {
  pool.on('connect', (client) => {
    client.query(`set search_path to "${schema}", public`).catch(console.error)
  })
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, schema ? { schema } : undefined),
}) as HRMSPrismaClient

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

type PolicyInput = {
  title: string
  category: string
  summary?: string | null
  content?: string | null
  fileUrl?: string | null
  version?: string | null
  effectiveDate?: string | null
  status?: string
}

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
      const data = {
        employeeId: String(e.employeeId),
        firstName: String(e.firstName),
        lastName: String(e.lastName),
        email: String(e.email),
        phone: e.phone ?? null,
        department: String((e as any).department || (e as any).departmentName || 'General'),
        position: String(e.position),
        employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as EmploymentType,
        joinDate: new Date(e.joinDate),
        status: String(e.status || 'ACTIVE').toUpperCase() as EmployeeStatus,
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
        await prisma.employee.upsert({
          where: { employeeId: String(e.employeeId) },
          update: {
            firstName: String(e.firstName),
            lastName: String(e.lastName),
            email: String(e.email),
            phone: e.phone ?? null,
            department: String((e as any).department || (e as any).departmentName || 'General'),
            position: String(e.position),
            employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as EmploymentType,
            joinDate: new Date(e.joinDate),
            status: String(e.status || 'ACTIVE').toUpperCase() as EmployeeStatus,
          },
          create: {
            employeeId: String(e.employeeId),
            firstName: String(e.firstName),
            lastName: String(e.lastName),
            email: String(e.email),
            phone: e.phone ?? null,
            department: String((e as any).department || (e as any).departmentName || 'General'),
            position: String(e.position),
            employmentType: String(e.employmentType || 'FULL_TIME').toUpperCase() as EmploymentType,
            joinDate: new Date(e.joinDate),
            status: String(e.status || 'ACTIVE').toUpperCase() as EmployeeStatus,
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

async function seedPolicies() {
  const list = readJSON<PolicyInput[]>('prisma/seed/policies.json')
    || readJSON<PolicyInput[]>('prisma/seed/policies.sample.json')
  if (!list?.length) {
    console.log('No policies to seed')
    return
  }
  let ok = 0
  for (const p of list) {
    try {
      const existing = await prisma.policy.findFirst({ where: { title: p.title } })
      if (existing) {
        await prisma.policy.update({ where: { id: existing.id }, data: {
          title: p.title,
          category: String(p.category).toUpperCase() as any,
          summary: p.summary ?? null,
          content: p.content ?? null,
          fileUrl: p.fileUrl ?? null,
          version: p.version ?? null,
          effectiveDate: p.effectiveDate ? new Date(p.effectiveDate) : null,
          status: String(p.status || 'ACTIVE').toUpperCase() as any,
        } })
        ok++
        continue
      }
      await prisma.policy.create({ data: {
        title: p.title,
        category: String(p.category).toUpperCase() as any,
        summary: p.summary ?? null,
        content: p.content ?? null,
        fileUrl: p.fileUrl ?? null,
        version: p.version ?? null,
        effectiveDate: p.effectiveDate ? new Date(p.effectiveDate) : null,
        status: String(p.status || 'ACTIVE').toUpperCase() as any,
      } })
      ok++
    } catch (e) {
      console.warn('Policy seed skipped:', p.title, e)
    }
  }
  console.log(`Seeded policies: ${ok}`)
}

async function main() {
  await seedEmployees()
  await seedResources()
  await seedPolicies()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
