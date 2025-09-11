'use client';

import { useState, useCallback } from 'react';
import { ReportDataHistory } from '@/components/reports/common/report-data-history';
import { ReportErrorBoundary } from '@/components/error-boundary';
import { useGeneralLedgerReport } from '@/hooks/use-report-data';
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

function GeneralLedgerContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ImportRecord | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  
  // Use the general ledger hook to fetch data
  const { refetch } = useGeneralLedgerReport();
  
  // Callback to handle refresh from ReportDataHistory
  const handleRefresh = useCallback(async () => {
    console.log('[GeneralLedgerPage] Refreshing general ledger data', {
      timestamp: new Date().toISOString()
    });
    
    // Increment refresh key to force re-render
    setRefreshKey(prev => prev + 1);
    
    // Refetch the general ledger data
    await refetch();
  }, [refetch]);
  
  // Handle report selection from history
  const handleSelectReport = useCallback(async (report: ImportRecord) => {
    console.log('[GeneralLedgerPage] Report selected from history', {
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
        reportType="GENERAL_LEDGER"
        reportTitle="General Ledger"
        reportDescription="Import and API fetch history for General Ledger reports"
        onRefresh={handleRefresh}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}

export default function GeneralLedgerPage() {
  return (
    <ReportErrorBoundary>
      <GeneralLedgerContent />
    </ReportErrorBoundary>
  );
}