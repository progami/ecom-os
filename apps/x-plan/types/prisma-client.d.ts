declare module '@prisma/client' {
  export type PrismaClientOptions = Record<string, unknown>;
  export type DefaultArgs = Record<string, unknown>;

  export type PurchaseOrderStatus =
    | 'PLANNED'
    | 'PRODUCTION'
    | 'IN_TRANSIT'
    | 'ARRIVED'
    | 'CLOSED'
    | 'CANCELLED';

  export interface Product {
    id: string;
    name: string;
    sku: string;
    isActive: boolean;
    createdAt?: Date;
    sellingPrice?: number | null;
    manufacturingCost?: number | null;
    freightCost?: number | null;
    tariffRate?: number | null;
    tacosPercent?: number | null;
    fbaFee?: number | null;
    amazonReferralRate?: number | null;
    storagePerMonth?: number | null;
    overrideSellingPrice?: number | null;
    overrideManufacturingCost?: number | null;
    overrideFreightCost?: number | null;
    overrideTariffRate?: number | null;
    overrideTacosPercent?: number | null;
    overrideFbaFee?: number | null;
    overrideReferralRate?: number | null;
    overrideStoragePerMonth?: number | null;
  }

  export interface LeadStageTemplate {
    id: string;
    label: string;
    defaultWeeks?: number | null;
    sequence: number;
  }

  export interface LeadTimeOverride {
    id?: string;
    productId: string;
    stageTemplateId: string;
    durationWeeks?: number | null;
  }

  export interface BusinessParameter {
    id: string;
    label: string;
    valueNumeric?: number | null;
    valueText?: string | null;
  }

  export interface PurchaseOrderPayment {
    id: string;
    purchaseOrderId: string;
    paymentIndex: number;
    percentage?: number | null;
    amount?: number | null;
    category?: string | null;
    label?: string | null;
    dueDate?: Date | null;
    status?: string | null;
    purchaseOrder: PurchaseOrder;
  }

  export interface BatchTableRow {
    id: string;
    purchaseOrderId: string;
    productId: string;
    quantity: number;
    batchCode?: string | null;
    overrideSellingPrice?: number | null;
    overrideManufacturingCost?: number | null;
    overrideFreightCost?: number | null;
    overrideTariffRate?: number | null;
    overrideTacosPercent?: number | null;
    overrideFbaFee?: number | null;
    overrideReferralRate?: number | null;
    overrideStoragePerMonth?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
    product: Product;
    purchaseOrder: PurchaseOrder;
  }

  export interface PurchaseOrder {
    id: string;
    orderCode: string;
    productId: string;
    poDate?: Date | null;
    quantity?: number | null;
    productionWeeks?: number | null;
    sourceWeeks?: number | null;
    oceanWeeks?: number | null;
    finalWeeks?: number | null;
    pay1Percent?: number | null;
    pay2Percent?: number | null;
    pay3Percent?: number | null;
    pay1Amount?: number | null;
    pay2Amount?: number | null;
    pay3Amount?: number | null;
    pay1Date?: Date | null;
    pay2Date?: Date | null;
    pay3Date?: Date | null;
    productionStart?: Date | null;
    productionComplete?: Date | null;
    sourceDeparture?: Date | null;
    transportReference?: string | null;
    shipName?: string | null;
    containerNumber?: string | null;
    portEta?: Date | null;
    inboundEta?: Date | null;
    availableDate?: Date | null;
    totalLeadDays?: number | null;
    status: PurchaseOrderStatus;
    statusIcon?: string | null;
    notes?: string | null;
    weeksUntilArrival?: number | null;
    overrideSellingPrice?: number | null;
    overrideManufacturingCost?: number | null;
    overrideFreightCost?: number | null;
    overrideTariffRate?: number | null;
    overrideTacosPercent?: number | null;
    overrideFbaFee?: number | null;
    overrideReferralRate?: number | null;
    overrideStoragePerMonth?: number | null;
    product: Product;
    payments: PurchaseOrderPayment[];
    batchTableRows: BatchTableRow[];
  }

  export interface SalesWeek {
    id: string;
    productId: string;
    weekNumber: number;
    weekDate: Date | null;
    stockStart?: number | null;
    actualSales?: number | null;
    forecastSales?: number | null;
    finalSales?: number | null;
    stockWeeks?: number | null;
    stockEnd?: number | null;
  }

  export interface ProfitAndLossWeek {
    id: string;
    weekNumber: number;
    weekDate: Date | null;
    units?: number | null;
    revenue?: number | null;
    cogs?: number | null;
    grossProfit?: number | null;
    grossMargin?: number | null;
    amazonFees?: number | null;
    ppcSpend?: number | null;
    fixedCosts?: number | null;
    totalOpex?: number | null;
    netProfit?: number | null;
  }

  export interface CashFlowWeek {
    id: string;
    weekNumber: number;
    weekDate: Date | null;
    amazonPayout?: number | null;
    inventorySpend?: number | null;
    fixedCosts?: number | null;
    netCash?: number | null;
    cashBalance?: number | null;
  }

  export interface MonthlySummary {
    id: string;
    periodLabel: string;
    year: number;
    month: number;
    revenue?: number | null;
    cogs?: number | null;
    grossProfit?: number | null;
    amazonFees?: number | null;
    ppcSpend?: number | null;
    fixedCosts?: number | null;
    totalOpex?: number | null;
    netProfit?: number | null;
    amazonPayout?: number | null;
    inventorySpend?: number | null;
    netCash?: number | null;
    closingCash?: number | null;
  }

  export interface QuarterlySummary {
    id: string;
    periodLabel: string;
    year: number;
    quarter: number;
    revenue?: number | null;
    cogs?: number | null;
    grossProfit?: number | null;
    amazonFees?: number | null;
    ppcSpend?: number | null;
    fixedCosts?: number | null;
    totalOpex?: number | null;
    netProfit?: number | null;
    amazonPayout?: number | null;
    inventorySpend?: number | null;
    netCash?: number | null;
    closingCash?: number | null;
  }

  export interface LogisticsEvent {
    id: string;
  }

  interface ModelDelegate<T> {
    findMany(args?: unknown): Promise<T[]>;
    findFirst(args?: unknown): Promise<T | null>;
    findUnique(args?: unknown): Promise<T | null>;
    create(args: unknown): Promise<T>;
    createMany(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<T>;
    delete(args: unknown): Promise<T>;
    deleteMany(args?: unknown): Promise<unknown>;
    upsert(args: unknown): Promise<T>;
    aggregate(args: unknown): Promise<unknown>;
  }

  export namespace Prisma {
    export type PrismaClientOptions = Record<string, unknown>;
    export type TransactionClient = PrismaClient;
    export class Decimal {
      constructor(value: string | number | bigint | Decimal);
      toNumber(): number;
      toString(): string;
      valueOf(): number;
    }
    export class PrismaClientKnownRequestError extends Error {
      code: string;
    }
  }

  export const Prisma: {
    Decimal: typeof Prisma.Decimal;
    PrismaClientKnownRequestError: typeof Prisma.PrismaClientKnownRequestError;
  };

  export type TransactionClient = PrismaClient;

  export class PrismaClient<
    T extends PrismaClientOptions = PrismaClientOptions,
    U = never,
    V = DefaultArgs
  > {
    constructor(options?: T);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $use(cb: unknown): void;
    $transaction<P>(promises: P): Promise<P>;
    $transaction<R>(fn: (client: PrismaClient) => Promise<R>): Promise<R>;
    $extends<ExtArgs = DefaultArgs>(...args: any[]): PrismaClient<T, U, ExtArgs>;
    $executeRawUnsafe(query: string): Promise<unknown>;
    product: ModelDelegate<Product>;
    businessParameter: ModelDelegate<BusinessParameter>;
    leadStageTemplate: ModelDelegate<LeadStageTemplate>;
    leadTimeOverride: ModelDelegate<LeadTimeOverride>;
    purchaseOrder: ModelDelegate<PurchaseOrder>;
    batchTableRow: ModelDelegate<BatchTableRow>;
    purchaseOrderPayment: ModelDelegate<PurchaseOrderPayment>;
    salesWeek: ModelDelegate<SalesWeek>;
    profitAndLossWeek: ModelDelegate<ProfitAndLossWeek>;
    cashFlowWeek: ModelDelegate<CashFlowWeek>;
    monthlySummary: ModelDelegate<MonthlySummary>;
    quarterlySummary: ModelDelegate<QuarterlySummary>;
    logisticsEvent: ModelDelegate<LogisticsEvent>;
  }
}
