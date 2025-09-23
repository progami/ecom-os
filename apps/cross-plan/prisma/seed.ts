import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { importWorkbookFromXLSX } from '../lib/workbook/importer'

const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS cross_plan;')
  await prisma.$executeRawUnsafe('SET search_path TO cross_plan;')
  const workbookPath = path.resolve(__dirname, '../excel_template.xlsx')
  const workbook = XLSX.readFile(workbookPath, { cellDates: false })
  await importWorkbookFromXLSX(workbook, prisma)
  console.log('Cross Plan seed complete')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
