'use client';

import { useState, useCallback } from 'react';
import { ReportDataHistory } from '@/components/reports/common/report-data-history';
import { ReportErrorBoundary } from '@/components/error-boundary';
import { useTrialBalanceReport } from '@/hooks/use-report-data';
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

function TrialBalanceContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ImportRecord | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  
  // Use the trial balance hook to fetch data
  const { refetch } = useTrialBalanceReport();
  
  // Callback to handle refresh from ReportDataHistory
  const handleRefresh = useCallback(async () => {
    console.log('[TrialBalancePage] Refreshing trial balance data', {
      timestamp: new Date().toISOString()
    });
    
    // Increment refresh key to force re-render
    setRefreshKey(prev => prev + 1);
    
    // Refetch the trial balance data
    await refetch();
  }, [refetch]);
  
  // Handle report selection from history
  const handleSelectReport = useCallback(async (report: ImportRecord) => {
    console.log('[TrialBalancePage] Report selected from history', {
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
        reportType="TRIAL_BALANCE"
        reportTitle="Trial Balance"
        reportDescription="Import and API fetch history for Trial Balance reports"
        onRefresh={handleRefresh}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}

export default function TrialBalancePage() {
  return (
    <ReportErrorBoundary>
      <TrialBalanceContent />
    </ReportErrorBoundary>
  );
}