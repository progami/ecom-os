const DEFAULT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(value: string | number | Date | null | undefined): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export function formatDateDisplay(
  value: string | number | Date | null | undefined,
  formatter: Intl.DateTimeFormat = DEFAULT_DATE_FORMATTER,
  fallback = '',
): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return formatter.format(date).replace(',', '');
}
