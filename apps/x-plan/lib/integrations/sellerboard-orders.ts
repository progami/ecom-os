import { createHash, timingSafeEqual } from 'crypto';
import { weekNumberForDate } from '@/lib/calculations/calendar';
import type { PlanningCalendar } from '@/lib/planning';

export type SellerboardOrderRow = Record<string, string>;

export type SellerboardWeeklyUnits = {
  productCode: string;
  weekNumber: number;
  units: number;
};

export type SellerboardOrdersParseResult = {
  rowsParsed: number;
  rowsSkipped: number;
  weekStartsOn: 0 | 1;
  weeklyUnits: SellerboardWeeklyUnits[];
  csvSha256: string;
  oldestPurchaseDateUtc: Date | null;
  newestPurchaseDateUtc: Date | null;
};

export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function normalizeCsvInput(content: string): string {
  if (!content) return '';
  return content.replace(/^\uFEFF/, '');
}

export function parseCsv(content: string): string[][] {
  const input = normalizeCsvInput(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        const next = input[index + 1];
        if (next === '"') {
          field += '"';
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\r') continue;

    if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quote');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseSellerboardPurchaseDateUtc(value: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Example: "12/30/2025 6:07:04 PM"
  const match = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i,
  );

  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const meridiem = match[7].toUpperCase();

  if (![month, day, year, hour, minute, second].every(Number.isFinite)) return null;

  if (hour < 1 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSellerboardOrdersWeeklyUnits(
  csv: string,
  planning: PlanningCalendar,
  options: {
    weekStartsOn: 0 | 1;
    productCodeHeader?: string;
    purchaseDateHeader?: string;
    unitsHeader?: string;
    statusHeader?: string;
    excludeStatuses?: string[];
  },
): SellerboardOrdersParseResult {
  const productCodeHeader = options.productCodeHeader ?? 'Products';
  const purchaseDateHeader = options.purchaseDateHeader ?? 'PurchaseDate(UTC)';
  const unitsHeader = options.unitsHeader ?? 'NumberOfItems';
  const statusHeader = options.statusHeader ?? 'OrderStatus';
  const excluded = new Set(
    (options.excludeStatuses ?? ['Cancelled']).map((item) => item.toLowerCase()),
  );

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return {
      rowsParsed: 0,
      rowsSkipped: 0,
      weekStartsOn: options.weekStartsOn,
      weeklyUnits: [],
      csvSha256: sha256Hex(csv),
      oldestPurchaseDateUtc: null,
      newestPurchaseDateUtc: null,
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => headerIndex.set(header, index));

  const required = [productCodeHeader, purchaseDateHeader, unitsHeader];
  for (const requiredHeader of required) {
    if (!headerIndex.has(requiredHeader)) {
      throw new Error(`Sellerboard CSV missing required column "${requiredHeader}"`);
    }
  }

  const getCell = (record: string[], key: string): string => {
    const index = headerIndex.get(key);
    if (index == null) return '';
    return record[index] ?? '';
  };

  const weeklyByProduct = new Map<string, Map<number, number>>();

  let rowsParsed = 0;
  let rowsSkipped = 0;
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const record of rows.slice(1)) {
    if (record.length === 1 && record[0].trim() === '') continue;

    const productCode = getCell(record, productCodeHeader).trim();
    const purchaseDateValue = getCell(record, purchaseDateHeader);
    const unitsValue = getCell(record, unitsHeader);
    const statusValue = statusHeader ? getCell(record, statusHeader) : '';

    if (!productCode) {
      rowsSkipped += 1;
      continue;
    }

    if (statusValue && excluded.has(statusValue.trim().toLowerCase())) {
      rowsSkipped += 1;
      continue;
    }

    const purchaseDateUtc = parseSellerboardPurchaseDateUtc(purchaseDateValue);
    if (!purchaseDateUtc) {
      rowsSkipped += 1;
      continue;
    }

    const rawUnits = Number(unitsValue);
    if (!Number.isFinite(rawUnits)) {
      rowsSkipped += 1;
      continue;
    }

    const units = Math.max(0, Math.round(rawUnits));
    const weekNumber = weekNumberForDate(purchaseDateUtc, planning.calendar);
    if (weekNumber == null) {
      rowsSkipped += 1;
      continue;
    }

    if (!oldest || purchaseDateUtc.getTime() < oldest.getTime()) {
      oldest = purchaseDateUtc;
    }
    if (!newest || purchaseDateUtc.getTime() > newest.getTime()) {
      newest = purchaseDateUtc;
    }

    const weekMap = weeklyByProduct.get(productCode) ?? new Map<number, number>();
    weekMap.set(weekNumber, (weekMap.get(weekNumber) ?? 0) + units);
    weeklyByProduct.set(productCode, weekMap);
    rowsParsed += 1;
  }

  const weeklyUnits: SellerboardWeeklyUnits[] = [];
  for (const [productCode, byWeek] of weeklyByProduct.entries()) {
    for (const [weekNumber, units] of byWeek.entries()) {
      const weekDate = planning.calendar.weekDates.get(weekNumber);
      if (!weekDate) continue;
      weeklyUnits.push({ productCode, weekNumber, units });
    }
  }

  weeklyUnits.sort((a, b) => {
    if (a.weekNumber === b.weekNumber) return a.productCode.localeCompare(b.productCode);
    return a.weekNumber - b.weekNumber;
  });

  return {
    rowsParsed,
    rowsSkipped,
    weekStartsOn: options.weekStartsOn,
    weeklyUnits,
    csvSha256: sha256Hex(csv),
    oldestPurchaseDateUtc: oldest,
    newestPurchaseDateUtc: newest,
  };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
