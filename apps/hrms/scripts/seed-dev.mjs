#!/usr/bin/env node
// Seed via API calls (server must be running on http://localhost:3006)
const base = process.env.HRMS_BASE_URL || 'http://localhost:3006'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Server did not become healthy in time')
}

async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function main() {
  console.log('Resetting database...')
  await prisma.employeeFile.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.resource.deleteMany({})
  await prisma.policy.deleteMany({})
  console.log('Database cleared.')

  console.log('Waiting for server health...')
  await waitForHealth()
  console.log('Seeding data via API...')

  // Employees
  const employees = [
    { employeeId: 'EMP1001', firstName: 'Umair', lastName: 'Afzal', email: 'umair.afzal@example.com', department: 'operations', position: 'Operations Manager', employmentType: 'FULL_TIME', joinDate: '2024-06-01' },
  ]
  for (const e of employees) {
    try { await post('/api/employees', e) } catch { /* ignore duplicates */ }
  }

  // Resources
  const resources = [
    // Accounting — only the specified entries
    { name: 'KB Financial Solutions', category: 'ACCOUNTING', subcategory: 'TAX_PREP', website: 'https://www.kbfinancialsolutions.ca/tax-preparation-and-filing' },
    { name: 'EcomCPA', category: 'ACCOUNTING', subcategory: 'FIRM_CPA', website: 'https://ecomcpa.com/' },
    { name: 'Finaloop', category: 'ACCOUNTING', subcategory: 'BESPOKE_E2E', website: 'https://www.finaloop.com/' },
  ]
  for (const r of resources) {
    try { await post('/api/resources', r) } catch {}
  }

  // Policies
  const policies = [
    { title: 'Leave Policy 2025', category: 'LEAVE', summary: 'Annual leave and sick leave rules', version: '1.0', status: 'ACTIVE' },
    { title: 'Performance Review', category: 'PERFORMANCE', summary: 'Bi-annual reviews', version: '1.0', status: 'ACTIVE' },
  ]
  for (const p of policies) {
    try { await post('/api/policies', p) } catch {}
  }

  console.log('Seed complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
