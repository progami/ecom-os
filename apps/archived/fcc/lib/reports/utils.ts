import { format, parseISO } from 'date-fns';
import { CHART_COLORS, NUMBER_FORMATS, AGING_BUCKETS } from './constants';

// Number formatting utilities
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', NUMBER_FORMATS.CURRENCY).format(num);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', NUMBER_FORMATS.PERCENTAGE).format(value / 100);
}

export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  const options = decimals === 0 ? NUMBER_FORMATS.INTEGER : {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };
  
  return new Intl.NumberFormat('en-US', options).format(num);
}

// Date formatting utilities
export function formatReportDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
  } catch {
    return '-';
  }
}

export function formatDateRange(from: Date | undefined, to: Date | undefined): string {
  if (!from && !to) return 'All time';
  if (from && !to) return `From ${formatReportDate(from)}`;
  if (!from && to) return `Until ${formatReportDate(to)}`;
  return `${formatReportDate(from)} - ${formatReportDate(to)}`;
}

// Chart data utilities
export function getChartColor(index: number, scheme: keyof typeof CHART_COLORS = 'primary'): string {
  const colors = CHART_COLORS[scheme];
  if (Array.isArray(colors)) {
    return colors[index % colors.length];
  }
  return colors;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Aging utilities
export function calculateAgingBucket(daysOverdue: number): string {
  const bucket = AGING_BUCKETS.find((b, index) => {
    const nextBucket = AGING_BUCKETS[index + 1];
    if (!nextBucket) return true;
    return daysOverdue < nextBucket.days;
  });
  return bucket?.label || 'Unknown';
}

export function getAgingColor(daysOverdue: number): string {
  if (daysOverdue <= 0) return CHART_COLORS.aging[0];
  if (daysOverdue <= 30) return CHART_COLORS.aging[1];
  if (daysOverdue <= 60) return CHART_COLORS.aging[2];
  return CHART_COLORS.aging[3];
}

// Data transformation utilities
export function aggregateByCategory<T>(
  data: T[],
  categoryKey: keyof T,
  valueKey: keyof T,
  limit = 10
): Array<{ name: string; value: number }> {
  const aggregated = data.reduce((acc, item) => {
    const category = String(item[categoryKey]);
    const value = Number(item[valueKey]) || 0;
    
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += value;
    
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(aggregated)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Export utilities
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Metric calculation utilities
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function getMetricVariant(value: number, threshold = 0): 'success' | 'danger' | 'warning' | 'default' {
  if (value > threshold) return 'success';
  if (value < -threshold) return 'danger';
  if (Math.abs(value) <= threshold) return 'warning';
  return 'default';
}