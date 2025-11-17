declare module '@ecom-os/prisma-x-plan' {
  namespace Prisma {
    class Decimal {
      constructor(value: number | string)
      toNumber(): number
      valueOf(): number
    }
  }

  class PrismaClient {
    constructor(options?: Record<string, any>)
    [model: string]: any
  }

  type Product = any
  type LeadStageTemplate = any
  type LeadTimeOverride = any
  type BusinessParameter = any
  type PurchaseOrder = any
  type PurchaseOrderPayment = any
  type LogisticsEvent = any
  type SalesWeek = any
  type ProfitAndLossWeek = any
  type CashFlowWeek = any
  type MonthlySummary = any
  type QuarterlySummary = any
  type PurchaseOrderStatus = string
  type LogisticsEventType = string
}

export {}
