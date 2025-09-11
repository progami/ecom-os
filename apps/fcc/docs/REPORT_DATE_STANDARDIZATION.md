# Report Date Standardization

## Overview

This document outlines the standardized approach for handling dates across all report types in the FCC application.

## Date Types

### 1. Point-in-Time Reports
Reports that show financial position at a specific date.
- **Balance Sheet**: Shows assets, liabilities, and equity as of a specific date
- **Trial Balance**: Shows account balances as of a specific date

### 2. Date Range Reports  
Reports that show activity over a period of time.
- **Profit & Loss**: Shows income and expenses for a period
- **Aged Payables/Receivables**: Shows outstanding amounts aged from a period
- **Bank Summary**: Shows transactions within a period

### 3. Monthly Reports
Reports that analyze data for a specific month.
- **Cash Flow**: Shows cash movements for a month
- **Monthly Budget**: Shows budget vs actual for a month

## Implementation

### Unified Date Picker Component
Located at: `/components/reports/unified-date-picker.tsx`

Features:
- Automatically adapts UI based on report type
- Provides relevant presets for each date type
- Consistent styling and behavior
- Chronologically ordered presets (most recent first)

### Report Date Configuration
Located at: `/lib/report-date-config.ts`

Centralized configuration that maps report types to:
- Date type (point-in-time, date-range, or month)
- Custom labels and descriptions
- Default preset selections

### Usage Example

```typescript
import { UnifiedDatePicker } from '@/components/reports/unified-date-picker'
import { getReportDateConfig } from '@/lib/report-date-config'

const dateConfig = getReportDateConfig('BALANCE_SHEET')

<UnifiedDatePicker
  dateType={dateConfig.dateType}
  value={selectedDate}
  onChange={setSelectedDate}
  label={dateConfig.label}
/>
```

## Benefits

1. **Consistency**: All reports use the same date selection interface
2. **Maintainability**: Centralized configuration makes updates easier
3. **User Experience**: Presets are logically ordered and relevant to each report type
4. **Flexibility**: Each report type can have custom labels while sharing the same component
5. **Extensibility**: New report types can be easily added to the configuration

## Date Preset Ordering

Presets are ordered from most recent to oldest:
1. Current period options (Today, This month, etc.)
2. Recent past options (Last month, Last quarter)
3. Older options (6 months ago, Last year)

This ordering helps users quickly select the most commonly used dates.