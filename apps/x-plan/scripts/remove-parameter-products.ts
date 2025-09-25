import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PARAMETER_LABELS = [
  'Amazon Payout Delay (weeks)',
  'Starting Cash',
  'Supplier Payment Split 1 (%)',
  'Supplier Payment Split 2 (%)',
  'Supplier Payment Split 3 (%)',
  'Supplier Payment Terms (weeks)',
  'Weekly Fixed Costs',
  'Weeks of Stock Warning Threshold',
]

const LEAD_STAGE_LABELS = ['Production Time', 'Source Prep', 'Ocean Transit', 'Final Mile', 'Total Default Cycle']

async function main() {
  const labels = new Set(PARAMETER_LABELS.concat(LEAD_STAGE_LABELS).map((label) => label.toLowerCase()))
  const removableProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { in: Array.from(labels.values()) } },
        { name: { in: PARAMETER_LABELS } },
        { name: { in: LEAD_STAGE_LABELS } },
      ],
    },
  })

  if (removableProducts.length === 0) {
    console.log('No parameter rows found in Product table.')
    return
  }

  await prisma.product.deleteMany({
    where: { id: { in: removableProducts.map((product) => product.id) } },
  })

  console.log(`Removed ${removableProducts.length} parameter rows from Product table.`)
}

main()
  .catch((error) => {
    console.error('Failed to clean products:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
