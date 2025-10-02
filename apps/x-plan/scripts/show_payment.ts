import prisma from '../lib/prisma'

async function main() {
  const payment = await prisma.purchaseOrderPayment.findFirst({
    orderBy: { paymentIndex: 'asc' },
    include: { purchaseOrder: true },
  })
  console.log(payment)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
