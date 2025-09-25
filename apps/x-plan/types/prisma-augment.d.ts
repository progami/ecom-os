import type { Prisma } from '@prisma/client'

type PrismaDelegate = {
  [method: string]: (...args: any[]) => any
}

declare module '@prisma/client' {
  export type PurchaseOrderStatus =
    | 'PLANNED'
    | 'PRODUCTION'
    | 'IN_TRANSIT'
    | 'ARRIVED'
    | 'CLOSED'
    | 'CANCELLED'

  export const PurchaseOrderStatus: {
    readonly PLANNED: 'PLANNED'
    readonly PRODUCTION: 'PRODUCTION'
    readonly IN_TRANSIT: 'IN_TRANSIT'
    readonly ARRIVED: 'ARRIVED'
    readonly CLOSED: 'CLOSED'
    readonly CANCELLED: 'CANCELLED'
  }

  export type LogisticsEventType =
    | 'PRODUCTION_START'
    | 'PRODUCTION_COMPLETE'
    | 'INBOUND_DEPARTURE'
    | 'PORT_ARRIVAL'
    | 'WAREHOUSE_ARRIVAL'
    | 'CUSTOM'

  export const LogisticsEventType: {
    readonly PRODUCTION_START: 'PRODUCTION_START'
    readonly PRODUCTION_COMPLETE: 'PRODUCTION_COMPLETE'
    readonly INBOUND_DEPARTURE: 'INBOUND_DEPARTURE'
    readonly PORT_ARRIVAL: 'PORT_ARRIVAL'
    readonly WAREHOUSE_ARRIVAL: 'WAREHOUSE_ARRIVAL'
    readonly CUSTOM: 'CUSTOM'
  }

  export namespace Prisma {
    interface TransactionClient extends PrismaClient {}
  }

  interface PrismaClient<
    T = Prisma.PrismaClientOptions,
    Null = never,
    ExtArgs extends Prisma.$Extensions.InternalArgs = Prisma.$Extensions.DefaultArgs
  > {
    businessParameter: PrismaDelegate
    cashFlowWeek: PrismaDelegate
    product: PrismaDelegate
    salesWeek: PrismaDelegate
    purchaseOrder: PrismaDelegate
    purchaseOrderPayment: PrismaDelegate
    leadTimeOverride: PrismaDelegate
    leadStageTemplate: PrismaDelegate
    profitAndLossWeek: PrismaDelegate
    monthlySummary: PrismaDelegate
    quarterlySummary: PrismaDelegate
    logisticsEvent: PrismaDelegate
  }
}
