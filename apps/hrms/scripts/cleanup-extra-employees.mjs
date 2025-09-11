#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const keep = new Set(['umair.afzal@example.com'])
  const all = await prisma.employee.findMany({ select: { id: true, email: true } })
  const toDelete = all.filter(e => !keep.has(e.email)).map(e => e.id)
  if (toDelete.length) {
    await prisma.employeeFile.deleteMany({ where: { employeeId: { in: toDelete } } })
    const res = await prisma.employee.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${res.count} employees (kept Umair)`) 
  } else {
    console.log('No extra employees to delete')
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })

