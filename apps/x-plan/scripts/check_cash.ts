import prisma from '../lib/prisma'
import {
  computePurchaseOrderDerived,
  buildProductCostIndex,
  normalizeBusinessParameters,
  buildLeadTimeProfiles,
} from '../lib/calculations'
import {
  mapProducts,
  mapLeadStageTemplates,
  mapLeadOverrides,
  mapBusinessParameters,
  mapPurchaseOrders,
} from '../lib/calculations/adapters'

async function main() {
  const [products, leadStages, overrides, businessParameters, purchaseOrders] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadStageTemplate.findMany({ orderBy: { sequence: 'asc' } }),
    prisma.leadTimeOverride.findMany(),
    prisma.businessParameter.findMany({ orderBy: { label: 'asc' } }),
    prisma.purchaseOrder.findMany({
      orderBy: { orderCode: 'asc' },
      include: {
        payments: { orderBy: { paymentIndex: 'asc' } },
        batchTableRows: true,
      },
    }),
  ])

  const productInputs = mapProducts(products)
  const productIndex = buildProductCostIndex(productInputs)
  const parameters = normalizeBusinessParameters(mapBusinessParameters(businessParameters))
  const leadProfiles = buildLeadTimeProfiles(
    mapLeadStageTemplates(leadStages),
    mapLeadOverrides(overrides),
    productInputs.map((product) => product.id)
  )

  const purchaseOrderInputs = mapPurchaseOrders(purchaseOrders as any)

  for (const order of purchaseOrderInputs) {
    const profile = leadProfiles.get(order.productId)
    if (!profile) continue
    const derived = computePurchaseOrderDerived(order, productIndex, profile, parameters)
    console.log('PO', order.orderCode, 'supplierTotal', derived.supplierCostTotal.toFixed(2))
    derived.plannedPayments.forEach((payment) => {
      console.log('  planned', payment.paymentIndex, payment.category, payment.plannedAmount.toFixed(2))
    })
  }

  console.log('\nDB payments:')
  for (const po of purchaseOrders) {
    console.log('PO', po.orderCode)
    for (const payment of po.payments) {
      console.log('  payment', payment.paymentIndex, 'expected', payment.amountExpected?.toString(), 'due', payment.dueDate)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
