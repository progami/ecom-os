#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const fmt = (r) => `${r.name} | ${r.category} | ${r.subcategory || ''} | ${r.website || ''} | id=${r.id}`
async function main(){
  const items = await prisma.resource.findMany({ orderBy: { name: 'asc' } })
  console.log(`Resources count: ${items.length}`)
  for (const r of items) console.log(fmt(r))
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>{await prisma.$disconnect()})
