import { createHash, timingSafeEqual } from 'crypto';

/**
 * Fetch CSV content from a Sellerboard report URL
 */
export async function fetchSellerboardCsv(reportUrl: string): Promise<string> {
  const response = await fetch(reportUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Sellerboard fetch failed: ${response.status}`);
  }
  return response.text();
}

/**
 * Generate SHA256 hash of content for change detection
 */
export function hashCsvContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Normalize CSV input by removing BOM if present
 */
function normalizeCsvInput(content: string): string {
  if (!content) return '';
  return content.replace(/^\uFEFF/, '');
}

/**
 * Parse CSV content into rows and cells
 * Handles quoted fields and escaped quotes
 */
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

/**
 * Generic CSV parser that converts rows to typed objects
 */
export function parseSellerboardCsv<T>(
  csvContent: string,
  rowParser: (row: Record<string, string>) => T | null
): T[] {
  const rows = parseCsv(csvContent);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  const results: T[] = [];

  for (const record of rows.slice(1)) {
    if (record.length === 1 && record[0].trim() === '') continue;

    const rowObject: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObject[header] = record[index] ?? '';
    });

    const parsed = rowParser(rowObject);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Timing-safe string comparison for token validation
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Parse Sellerboard date format to UTC Date
 * Example: "12/30/2025 6:07:04 PM" -> Date
 */
export function parseSellerboardDateUtc(value: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i
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
