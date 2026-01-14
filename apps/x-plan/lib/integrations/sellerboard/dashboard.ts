import { weekNumberForDate } from '@/lib/calculations/calendar';
import type { PlanningCalendar } from '@/lib/planning';
import { parseCsv, hashCsvContent, parseSellerboardDateUtc } from './client';
import type { SellerboardWeeklyFinancials, SellerboardDashboardParseResult } from './types';

export type { SellerboardWeeklyFinancials, SellerboardDashboardParseResult };

type WeeklyFinancialsAccumulator = {
  revenue: number;
  amazonFees: number;
  referralFees: number;
  fbaFees: number;
  refunds: number;
  ppcSpend: number;
  netProfit: number;
};

/**
 * Parse Sellerboard Dashboard by Day CSV and aggregate by product/week
 *
 * Expected columns (configurable via options):
 * - Date: The date of the data row
 * - Product: SKU or ASIN identifier
 * - Ordered product sales: Revenue
 * - Amazon fees: Combined referral + FBA fees (or separate columns)
 * - Referral fees: Amazon referral fees
 * - FBA fees: Fulfillment by Amazon fees
 * - Refunds: Refunded amounts
 * - PPC spend: Pay-per-click advertising spend
 * - Net profit: Net profit after all costs
 */
export function parseSellerboardDashboardWeeklyFinancials(
  csv: string,
  planning: PlanningCalendar,
  options: {
    weekStartsOn: 0 | 1;
    dateHeader?: string;
    productHeader?: string;
    revenueHeader?: string;
    amazonFeesHeader?: string;
    referralFeesHeader?: string;
    fbaFeesHeader?: string;
    refundsHeader?: string;
    ppcSpendHeader?: string;
    netProfitHeader?: string;
  }
): SellerboardDashboardParseResult {
  const dateHeader = options.dateHeader ?? 'Date';
  const productHeader = options.productHeader ?? 'Product';
  const revenueHeader = options.revenueHeader ?? 'Ordered product sales';
  const amazonFeesHeader = options.amazonFeesHeader ?? 'Amazon fees';
  const referralFeesHeader = options.referralFeesHeader ?? 'Referral fees';
  const fbaFeesHeader = options.fbaFeesHeader ?? 'FBA fees';
  const refundsHeader = options.refundsHeader ?? 'Refunds';
  const ppcSpendHeader = options.ppcSpendHeader ?? 'PPC spend';
  const netProfitHeader = options.netProfitHeader ?? 'Net profit';

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return {
      rowsParsed: 0,
      rowsSkipped: 0,
      weekStartsOn: options.weekStartsOn,
      weeklyFinancials: [],
      csvSha256: hashCsvContent(csv),
      oldestDateUtc: null,
      newestDateUtc: null,
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => headerIndex.set(header, index));

  const required = [dateHeader, productHeader];
  for (const requiredHeader of required) {
    if (!headerIndex.has(requiredHeader)) {
      throw new Error(`Sellerboard Dashboard CSV missing required column "${requiredHeader}"`);
    }
  }

  const getCell = (record: string[], key: string): string => {
    const index = headerIndex.get(key);
    if (index == null) return '';
    return record[index] ?? '';
  };

  const parseNumeric = (value: string): number => {
    // Remove currency symbols, commas, and parse
    const cleaned = value.replace(/[$,]/g, '').trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  // Map: productCode -> weekNumber -> accumulated financials
  const weeklyByProduct = new Map<string, Map<number, WeeklyFinancialsAccumulator>>();

  let rowsParsed = 0;
  let rowsSkipped = 0;
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const record of rows.slice(1)) {
    if (record.length === 1 && record[0].trim() === '') continue;

    const productCode = getCell(record, productHeader).trim();
    const dateValue = getCell(record, dateHeader);

    if (!productCode) {
      rowsSkipped += 1;
      continue;
    }

    const dateUtc = parseSellerboardDateUtc(dateValue);
    if (!dateUtc) {
      rowsSkipped += 1;
      continue;
    }

    const weekNumber = weekNumberForDate(dateUtc, planning.calendar);
    if (weekNumber == null) {
      rowsSkipped += 1;
      continue;
    }

    if (!oldest || dateUtc.getTime() < oldest.getTime()) {
      oldest = dateUtc;
    }
    if (!newest || dateUtc.getTime() > newest.getTime()) {
      newest = dateUtc;
    }

    // Parse financial values
    const revenue = parseNumeric(getCell(record, revenueHeader));
    const amazonFees = parseNumeric(getCell(record, amazonFeesHeader));
    const referralFees = parseNumeric(getCell(record, referralFeesHeader));
    const fbaFees = parseNumeric(getCell(record, fbaFeesHeader));
    const refunds = parseNumeric(getCell(record, refundsHeader));
    const ppcSpend = parseNumeric(getCell(record, ppcSpendHeader));
    const netProfit = parseNumeric(getCell(record, netProfitHeader));

    // Get or create product's week map
    const weekMap =
      weeklyByProduct.get(productCode) ?? new Map<number, WeeklyFinancialsAccumulator>();

    // Get or create week accumulator
    const existing = weekMap.get(weekNumber) ?? {
      revenue: 0,
      amazonFees: 0,
      referralFees: 0,
      fbaFees: 0,
      refunds: 0,
      ppcSpend: 0,
      netProfit: 0,
    };

    // Accumulate values
    existing.revenue += revenue;
    existing.amazonFees += amazonFees;
    existing.referralFees += referralFees;
    existing.fbaFees += fbaFees;
    existing.refunds += refunds;
    existing.ppcSpend += ppcSpend;
    existing.netProfit += netProfit;

    weekMap.set(weekNumber, existing);
    weeklyByProduct.set(productCode, weekMap);
    rowsParsed += 1;
  }

  // Convert to flat array
  const weeklyFinancials: SellerboardWeeklyFinancials[] = [];
  for (const [productCode, byWeek] of weeklyByProduct.entries()) {
    for (const [weekNumber, financials] of byWeek.entries()) {
      const weekDate = planning.calendar.weekDates.get(weekNumber);
      if (!weekDate) continue;
      weeklyFinancials.push({
        productCode,
        weekNumber,
        revenue: financials.revenue,
        amazonFees: financials.amazonFees,
        referralFees: financials.referralFees,
        fbaFees: financials.fbaFees,
        refunds: financials.refunds,
        ppcSpend: financials.ppcSpend,
        netProfit: financials.netProfit,
      });
    }
  }

  weeklyFinancials.sort((a, b) => {
    if (a.weekNumber === b.weekNumber) return a.productCode.localeCompare(b.productCode);
    return a.weekNumber - b.weekNumber;
  });

  return {
    rowsParsed,
    rowsSkipped,
    weekStartsOn: options.weekStartsOn,
    weeklyFinancials,
    csvSha256: hashCsvContent(csv),
    oldestDateUtc: oldest,
    newestDateUtc: newest,
  };
}
