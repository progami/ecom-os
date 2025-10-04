import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const param = await prisma.businessParameter.findUnique({
    where: { label: 'Weekly Fixed Costs' },
  })

  if (!param) {
    console.log('Weekly Fixed Costs parameter not found')
    return
  }

  if (param.valueNumeric !== null && param.valueNumeric !== undefined) {
    console.log('Weekly Fixed Costs already has numeric value:', param.valueNumeric.toString())
    return
  }

  // Convert text value to numeric
  const textValue = param.valueText || '5000'
  const numericValue = new Prisma.Decimal(textValue)

  await prisma.businessParameter.update({
    where: { label: 'Weekly Fixed Costs' },
    data: {
      valueNumeric: numericValue,
      valueText: null,
    },
  })

  console.log(`Migrated Weekly Fixed Costs from text "${textValue}" to numeric ${numericValue}`)
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
