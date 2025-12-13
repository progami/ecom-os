'use client';

import { useState, useCallback } from 'react';
import { ReportDataHistory } from '@/components/reports/common/report-data-history';
import { ReportErrorBoundary } from '@/components/error-boundary';
import { useBalanceSheetReport } from '@/hooks/use-report-data';
// Removed server-side logger import - using console.log for client-side

interface ImportRecord {
  id: string;
  dateTime: Date;
  type: 'manual' | 'api';
  status: 'success' | 'failed' | 'processing';
  recordsImported: number;
  fileName?: string;
  reportType: string;
  periodStart?: Date;
  periodEnd: Date;
  importedBy: string;
  errors?: string[];
  metadata?: Record<string, any>;
}

function BalanceSheetContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ImportRecord | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  
  // Use the balance sheet hook to fetch data
  const { refetch } = useBalanceSheetReport();
  
  // Callback to handle refresh from ReportDataHistory
  const handleRefresh = useCallback(async () => {
    console.log('[BalanceSheetPage] Refreshing balance sheet data', {
      timestamp: new Date().toISOString()
    });
    
    // Increment refresh key to force re-render
    setRefreshKey(prev => prev + 1);
    
    // Refetch the balance sheet data
    await refetch();
  }, [refetch]);
  
  // Handle report selection from history
  const handleSelectReport = useCallback(async (report: ImportRecord) => {
    console.log('[BalanceSheetPage] Report selected from history', {
      reportId: report.id,
      timestamp: new Date().toISOString()
    });
    
    setSelectedReport(report);
    setSelectedReportData(null);
  }, []);
  
  return (
    <div className="space-y-8">
      {/* Import/Fetch History Section */}
      <ReportDataHistory
        key={refreshKey}
        reportType="BALANCE_SHEET"
        reportTitle="Balance Sheet"
        reportDescription="Import and API fetch history for Balance Sheet reports"
        onRefresh={handleRefresh}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <ReportErrorBoundary>
      <BalanceSheetContent />
    </ReportErrorBoundary>
  );
}