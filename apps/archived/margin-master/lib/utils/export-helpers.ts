import { getCountryName, getCurrencySymbol } from './format-helpers';

export function convertToCSV(data: any[], columns: { key: string; label: string }[]): string {
  if (!data || data.length === 0) return '';

  // Create header row
  const headers = columns.map(col => col.label).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export helpers for each table type
export function exportFulfilmentFees(fees: any[], type: 'standard' | 'lowprice') {
  const columns = [
    { key: 'sizeTierName', label: 'Size Tier' },
    { key: 'lengthLimitCm', label: 'Length Limit (cm)' },
    { key: 'widthLimitCm', label: 'Width Limit (cm)' },
    { key: 'heightLimitCm', label: 'Height Limit (cm)' },
    { key: 'rateWeightLowerBoundKg', label: 'Min Weight (kg)' },
    { key: 'rateWeightUpperBoundKg', label: 'Max Weight (kg)' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'currency', label: 'Currency' },
    { key: 'fee', label: 'Fee' }
  ];

  if (type === 'lowprice') {
    columns.unshift({ key: 'programName', label: 'Program' });
  }

  const csvContent = convertToCSV(fees, columns);
  const filename = `amazon-${type}-fba-fees-${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(filename, csvContent);
}

export function exportStorageFees(fees: any[]) {
  const columns = [
    { key: 'marketplaceGroup', label: 'Marketplace' },
    { key: 'productSize', label: 'Product Size' },
    { key: 'productCategory', label: 'Product Category' },
    { key: 'period', label: 'Period' },
    { key: 'currency', label: 'Currency' },
    { key: 'fee', label: 'Fee' },
    { key: 'unitOfMeasure', label: 'Unit' }
  ];

  const csvContent = convertToCSV(fees, columns);
  downloadCSV('amazon-storage-fees-' + new Date().toISOString().split('T')[0] + '.csv', csvContent);
}

export function exportReferralFees(fees: any[]) {
  const columns = [
    { key: 'marketplaceGroup', label: 'Marketplace' },
    { key: 'productCategory', label: 'Category' },
    { key: 'productSubcategory', label: 'Subcategory' },
    { key: 'priceLowerBound', label: 'Min Price' },
    { key: 'priceUpperBound', label: 'Max Price' },
    { key: 'currency', label: 'Currency' },
    { key: 'feePercentage', label: 'Fee %' },
    { key: 'minReferralFee', label: 'Min Fee' }
  ];

  const csvContent = convertToCSV(fees, columns);
  downloadCSV('amazon-referral-fees-' + new Date().toISOString().split('T')[0] + '.csv', csvContent);
}

export function exportSippDiscounts(discounts: any[], type: 'standard' | 'lowprice') {
  const columns = [
    { key: 'programName', label: 'Program' },
    { key: 'sizeTierName', label: 'Size Tier' },
    { key: 'rateWeightLowerBoundKg', label: 'Min Weight (kg)' },
    { key: 'rateWeightUpperBoundKg', label: 'Max Weight (kg)' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'currency', label: 'Currency' },
    { key: 'discount', label: 'Discount' }
  ];

  const csvContent = convertToCSV(discounts, columns);
  const fbaRateCardDate = '2025-02-01';
  const filename = `amazon-${type}-sipp-discounts-${fbaRateCardDate}.csv`;
  downloadCSV(filename, csvContent);
}

export function exportLowInventoryFees(fees: any[]) {
  const columns = [
    { key: 'marketplaceGroup', label: 'Marketplace' },
    { key: 'tierGroup', label: 'Tier Group' },
    { key: 'tierWeightLimitKg', label: 'Weight Limit (kg)' },
    { key: 'daysOfSupplyLowerBound', label: 'Min Days' },
    { key: 'daysOfSupplyUpperBound', label: 'Max Days' },
    { key: 'currency', label: 'Currency' },
    { key: 'fee', label: 'Fee' }
  ];

  const csvContent = convertToCSV(fees, columns);
  downloadCSV('amazon-low-inventory-fees-' + new Date().toISOString().split('T')[0] + '.csv', csvContent);
}