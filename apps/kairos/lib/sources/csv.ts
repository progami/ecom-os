import 'server-only';

export type CSVParseResult = {
  headers: string[];
  rows: string[][];
};

export type CSVTimeSeriesPoint = {
  t: Date;
  value: number;
};

export type CSVParseOptions = {
  dateColumn: string;
  valueColumn: string;
  productColumn?: string;
  dateFormat?: string;
};

export type CSVTimeSeriesResult = {
  points: CSVTimeSeriesPoint[];
  granularity: 'DAILY' | 'WEEKLY';
  productKey?: string;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCSV(content: string): CSVParseResult {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);

  return { headers, rows };
}

function parseDate(value: string): Date {
  const trimmed = value.trim();

  // Try ISO format first
  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try common date formats
  // MM/DD/YYYY or M/D/YYYY
  const usFormat = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usFormat) {
    const [, month, day, year] = usFormat;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // DD/MM/YYYY or D/M/YYYY
  const euFormat = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (euFormat) {
    const [, day, month, year] = euFormat;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // YYYY/MM/DD
  const altFormat = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (altFormat) {
    const [, year, month, day] = altFormat;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  throw new Error(`Unable to parse date: ${value}`);
}

function parseNumber(value: string): number {
  const trimmed = value.trim().replace(/[,$]/g, '');
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw new Error(`Unable to parse number: ${value}`);
  }
  return num;
}

function detectGranularity(points: CSVTimeSeriesPoint[]): 'DAILY' | 'WEEKLY' {
  if (points.length < 2) {
    return 'DAILY';
  }

  const sorted = [...points].sort((a, b) => a.t.getTime() - b.t.getTime());
  const diffMs = sorted[1].t.getTime() - sorted[0].t.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 6 ? 'WEEKLY' : 'DAILY';
}

export function parseCSVToTimeSeries(
  content: string,
  options: CSVParseOptions,
): CSVTimeSeriesResult[] {
  const { headers, rows } = parseCSV(content);

  const dateIndex = headers.findIndex(
    (h) => h.toLowerCase() === options.dateColumn.toLowerCase(),
  );
  const valueIndex = headers.findIndex(
    (h) => h.toLowerCase() === options.valueColumn.toLowerCase(),
  );
  const productIndex = options.productColumn
    ? headers.findIndex((h) => h.toLowerCase() === options.productColumn!.toLowerCase())
    : -1;

  if (dateIndex === -1) {
    throw new Error(`Date column "${options.dateColumn}" not found in CSV.`);
  }
  if (valueIndex === -1) {
    throw new Error(`Value column "${options.valueColumn}" not found in CSV.`);
  }
  if (options.productColumn && productIndex === -1) {
    throw new Error(`Product column "${options.productColumn}" not found in CSV.`);
  }

  // Group rows by product (if product column specified)
  const grouped = new Map<string, { t: Date; value: number }[]>();

  for (const row of rows) {
    const dateValue = row[dateIndex];
    const numericValue = row[valueIndex];
    const productKey = productIndex >= 0 ? row[productIndex] : '';

    if (!dateValue || !numericValue) {
      continue;
    }

    try {
      const t = parseDate(dateValue);
      const value = parseNumber(numericValue);

      const existing = grouped.get(productKey) ?? [];
      existing.push({ t, value });
      grouped.set(productKey, existing);
    } catch {
      // Skip invalid rows
      continue;
    }
  }

  if (grouped.size === 0) {
    throw new Error('No valid data rows found in CSV.');
  }

  const results: CSVTimeSeriesResult[] = [];

  for (const [productKey, points] of grouped.entries()) {
    const sorted = points.sort((a, b) => a.t.getTime() - b.t.getTime());
    const granularity = detectGranularity(sorted);

    results.push({
      points: sorted,
      granularity,
      productKey: productKey || undefined,
    });
  }

  return results;
}

export function getCSVPreview(
  content: string,
  maxRows: number = 5,
): { headers: string[]; rows: string[][] } {
  const { headers, rows } = parseCSV(content);
  return {
    headers,
    rows: rows.slice(0, maxRows),
  };
}
