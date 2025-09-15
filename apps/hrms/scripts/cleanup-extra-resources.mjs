#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const namesToDelete = [
    'Xero',
    'QuickBooks Online',
    'Zoho Books',
    'A2X',
    'Link My Books',
    'Acme Accounting',
    'Pixel Design Studio',
  ]
  const res = await prisma.resource.deleteMany({ where: { name: { in: namesToDelete } } })
  console.log(`Deleted ${res.count} extra resources`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
