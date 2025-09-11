# Import History Component System

A comprehensive component system for managing and displaying import history across all financial reports in the FCC application.

## Overview

The Import History component system provides a unified way to:
- Display previous file imports with metadata
- Show import status (completed, failed, processing)
- Handle report-specific date formatting
- Enable data source switching between imported and live data
- Support import comparison and bulk actions

## Component Structure

### Core Components

1. **ImportHistory** - Main container component
   - Manages state and data fetching
   - Handles filtering and search
   - Coordinates child components

2. **ImportHistoryItem** - Individual import entry display
   - Shows import metadata (file, date, status)
   - Displays report-specific date formatting
   - Provides action buttons

3. **ImportDateDisplay** - Smart date formatter
   - Handles different date formats per report type
   - YTD format for Trial Balance
   - Monthly format for Cash Flow
   - Point-in-time for Aged reports
   - Period ranges for P&L, Balance Sheet

4. **ImportActions** - Action button group
   - View imported data
   - Delete import
   - Select for comparison

5. **ImportHistoryFilter** - Advanced filtering UI
   - Search by filename or user
   - Filter by status, source, date range
   - Report type filtering for multi-report views

## Report-Specific Date Handling

Each report type has specific date display requirements:

```typescript
// Trial Balance - YTD Format
"Jan 1 - Dec 31, 2023"

// Cash Flow - Monthly
"December 2023"

// Aged Reports - Point in Time
"As of Dec 31, 2023"

// P&L, Balance Sheet - Period Range
"Oct 1 - Dec 31, 2023"
```

## Integration Approach

### 1. Basic Integration

```tsx
import { ImportHistory } from '@/components/reports/import-history'

function MyReportPage() {
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  
  return (
    <ImportHistory
      reportType="BALANCE_SHEET"
      onSelectImport={setSelectedImportId}
      maxItems={5}
    />
  )
}
```

### 2. With Data Source Toggle

```tsx
function ReportWithToggle() {
  const [dataSource, setDataSource] = useState<'live' | 'imported'>('live')
  const [importId, setImportId] = useState<string | null>(null)
  
  const handleSelectImport = (id: string) => {
    setImportId(id)
    setDataSource('imported')
    // Load imported data
  }
  
  return (
    <>
      {/* Data Source Toggle */}
      <div className="flex gap-2">
        <button 
          onClick={() => setDataSource('live')}
          className={dataSource === 'live' ? 'active' : ''}
        >
          Live Data
        </button>
        <button 
          onClick={() => setDataSource('imported')}
          className={dataSource === 'imported' ? 'active' : ''}
        >
          Imported Data
        </button>
      </div>
      
      {/* Import History */}
      {dataSource === 'imported' && (
        <ImportHistory
          reportType="BALANCE_SHEET"
          onSelectImport={handleSelectImport}
        />
      )}
    </>
  )
}
```

### 3. With Comparison Feature

```tsx
function ReportWithComparison() {
  const handleCompareImports = (importIds: string[]) => {
    // Navigate to comparison view
    router.push(`/reports/compare?ids=${importIds.join(',')}`)
  }
  
  return (
    <ImportHistory
      reportType="CASH_FLOW"
      onCompareImports={handleCompareImports}
    />
  )
}
```

## API Endpoints

### Get Import History
```
GET /api/v1/reports/import-history
Query params:
- reportType: Filter by report type
- limit: Number of items (default: 10)
- offset: Pagination offset
- status: Filter by status
- source: Filter by source
```

### Delete Import
```
DELETE /api/v1/reports/import-history?id={importId}
```

## Props Reference

### ImportHistory Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| reportType | ReportType | - | Filter imports by report type |
| onSelectImport | (id: string) => void | - | Callback when import is selected |
| onDeleteImport | (id: string) => Promise<void> | - | Callback to delete import |
| onCompareImports | (ids: string[]) => void | - | Callback for comparison |
| showActions | boolean | true | Show action buttons |
| maxItems | number | 10 | Maximum items to display |
| className | string | - | Additional CSS classes |

## Features

### Smart Date Formatting
- Automatically formats dates based on report type
- Handles YTD, monthly, point-in-time, and period formats
- Consistent display across all reports

### Filtering & Search
- Search by filename or user
- Filter by status, source, report type
- Date range filtering
- Real-time filter updates

### Status Indicators
- Visual status badges (completed, failed, processing)
- Error message display for failed imports
- Processing animations

### Bulk Actions
- Select multiple imports for comparison
- Bulk delete functionality (future enhancement)
- Export selected imports (future enhancement)

## Future Enhancements

1. **Import Validation**
   - Pre-import data validation
   - Column mapping interface
   - Data preview before confirmation

2. **Advanced Comparison**
   - Side-by-side data comparison
   - Variance analysis
   - Trend visualization

3. **Import Templates**
   - Save import configurations
   - Auto-map columns based on templates
   - Batch import processing

4. **Audit Trail**
   - Detailed import logs
   - User activity tracking
   - Change history

## Best Practices

1. **Performance**
   - Implement pagination for large import lists
   - Use React.memo for list items
   - Lazy load import details

2. **Error Handling**
   - Show clear error messages
   - Provide retry options
   - Log errors for debugging

3. **User Experience**
   - Show loading states
   - Provide feedback for actions
   - Maintain filter state across sessions

4. **Security**
   - Validate user permissions
   - Sanitize file uploads
   - Implement rate limiting