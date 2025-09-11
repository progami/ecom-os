'use client';

import { useState, useCallback } from 'react';
import { ReportDataHistory } from '@/components/reports/common/report-data-history';
import { ReportErrorBoundary } from '@/components/error-boundary';
import { useProfitLossReport } from '@/hooks/use-report-data';
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

function ProfitLossContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ImportRecord | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  
  // Use the profit & loss hook to fetch data
  const { refetch } = useProfitLossReport();
  
  // Callback to handle refresh from ReportDataHistory
  const handleRefresh = useCallback(async () => {
    console.log('[ProfitLossPage] Refreshing profit & loss data', {
      timestamp: new Date().toISOString()
    });
    
    // Increment refresh key to force re-render
    setRefreshKey(prev => prev + 1);
    
    // Refetch the profit & loss data
    await refetch();
  }, [refetch]);
  
  // Handle report selection from history
  const handleSelectReport = useCallback(async (report: ImportRecord) => {
    console.log('[ProfitLossPage] Report selected from history', {
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
        reportType="PROFIT_LOSS"
        reportTitle="Profit & Loss"
        reportDescription="Import and API fetch history for Profit & Loss reports"
        onRefresh={handleRefresh}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}

export default function ProfitLossPage() {
  return (
    <ReportErrorBoundary>
      <ProfitLossContent />
    </ReportErrorBoundary>
  );
}