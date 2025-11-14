import { Prisma, PrismaClient } from '@prisma/client'
import { OPS_STAGE_DEFAULT_LABELS } from '../lib/business-parameter-labels'

const prisma = new PrismaClient()

async function main() {
  // Seed business parameters
  const parameters = [
    // Operations parameters
    { label: 'Default Lead Time (weeks)', valueNumeric: new Prisma.Decimal(4) },
    { label: OPS_STAGE_DEFAULT_LABELS.production, valueNumeric: new Prisma.Decimal(1) },
    { label: OPS_STAGE_DEFAULT_LABELS.source, valueNumeric: new Prisma.Decimal(1) },
    { label: OPS_STAGE_DEFAULT_LABELS.ocean, valueNumeric: new Prisma.Decimal(1) },
    { label: OPS_STAGE_DEFAULT_LABELS.final, valueNumeric: new Prisma.Decimal(1) },

    // Sales parameters
    { label: 'Stockout Warning (weeks)', valueNumeric: new Prisma.Decimal(2) },

    // Finance parameters
    { label: 'Payment Terms (days)', valueNumeric: new Prisma.Decimal(30) },
    { label: 'Weekly Fixed Costs', valueNumeric: new Prisma.Decimal(5000) },
  ]

  for (const param of parameters) {
    await prisma.businessParameter.upsert({
      where: { label: param.label },
      update: {},
      create: param,
    })
  }

  // Seed lead stage templates
  const stages = [
    { label: 'Production', defaultWeeks: new Prisma.Decimal(4), sequence: 1 },
    { label: 'Quality Control', defaultWeeks: new Prisma.Decimal(0.5), sequence: 2 },
    { label: 'Domestic Logistics', defaultWeeks: new Prisma.Decimal(1), sequence: 3 },
    { label: 'Ocean Freight', defaultWeeks: new Prisma.Decimal(4), sequence: 4 },
    { label: 'Customs Clearance', defaultWeeks: new Prisma.Decimal(0.5), sequence: 5 },
    { label: 'Final Mile', defaultWeeks: new Prisma.Decimal(1), sequence: 6 },
  ]

  for (const stage of stages) {
    await prisma.leadStageTemplate.upsert({
      where: { sequence: stage.sequence },
      update: {},
      create: stage,
    })
  }

  console.log('X-Plan seed complete')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
