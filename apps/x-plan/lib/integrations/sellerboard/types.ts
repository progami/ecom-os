// Sellerboard data types

// Raw CSV row from Orders report
export type SellerboardOrderRow = {
  amazonOrderId: string;
  purchaseDateUtc: Date;
  products: string; // SKU or ASIN
  numberOfItems: number;
  orderStatus: string;
};

// Raw CSV row from Dashboard by day report
export type SellerboardDashboardRow = {
  date: Date;
  product: string; // SKU or ASIN
  units: number;
  revenue: number;
  amazonFees: number; // referral + FBA combined
  refunds: number;
  ppcSpend: number;
  netProfit: number;
};

// Aggregated weekly data
export type SellerboardWeeklyData = {
  weekNumber: number;
  weekDate: Date; // Monday of the week
  productCode: string;
  units: number;
  revenue: number;
  amazonFees: number;
  refunds: number;
  ppcSpend: number;
  netProfit: number;
  orderCount: number;
  hasActualData: boolean;
};

// Weekly units from Orders report
export type SellerboardWeeklyUnits = {
  productCode: string;
  weekNumber: number;
  units: number;
};

// Parse result from Orders CSV
export type SellerboardOrdersParseResult = {
  rowsParsed: number;
  rowsSkipped: number;
  weekStartsOn: 0 | 1;
  weeklyUnits: SellerboardWeeklyUnits[];
  csvSha256: string;
  oldestPurchaseDateUtc: Date | null;
  newestPurchaseDateUtc: Date | null;
};

// Sync result
export type SellerboardSyncResult = {
  success: boolean;
  rowsParsed: number;
  rowsSkipped: number;
  productsMatched: number;
  weeksUpdated: number;
  errors: string[];
  csvSha256: string;
  dateRange: {
    oldest: Date | null;
    newest: Date | null;
  };
};

// US Actual Sales Sync result
export type SellerboardUsActualSalesSyncResult = {
  rowsParsed: number;
  rowsSkipped: number;
  productsMatched: number;
  asinMappingsFound: number;
  asinProductsMatched: number;
  updates: number;
  csvSha256: string;
  oldestPurchaseDateUtc: Date | null;
  newestPurchaseDateUtc: Date | null;
};
