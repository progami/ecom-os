#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const all = await prisma.resource.findMany({ orderBy: { createdAt: 'asc' } })
  const seen = new Map()
  const toDelete = []
  for (const r of all) {
    const key = `${r.website || ''}__${r.name}__${r.category}__${r.subcategory || ''}`.toLowerCase()
    if (seen.has(key)) {
      toDelete.push(r.id)
    } else {
      seen.set(key, r.id)
    }
  }
  if (toDelete.length) {
    const res = await prisma.resource.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${res.count} duplicate resources`)
  } else {
    console.log('No duplicate resources found')
  }
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(async ()=>{ await prisma.$disconnect() })

