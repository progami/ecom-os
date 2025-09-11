'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  RefreshCw, 
  Database, 
  FileText, 
  Calendar, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Upload,
  AlertCircle,
  ChevronRight,
  Cloud,
  Lock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { UnifiedPageHeader } from '@/components/ui/unified-page-header';
import { DataTable } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/design-tokens';
import { ImportDetailsModal } from '@/components/reports/import-details-modal';
import { XeroFetchDialog } from '@/components/reports/xero-fetch-dialog';
import { useAuth } from '@/contexts/AuthContext';

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

interface ReportDataHistoryProps {
  reportType: string;
  reportTitle: string;
  reportDescription?: string;
  onRefresh?: () => Promise<void>;
  onSelectReport?: (report: ImportRecord) => void;
  className?: string;
}

export function ReportDataHistory({
  reportType,
  reportTitle,
  reportDescription,
  onRefresh,
  onSelectReport,
  className
}: ReportDataHistoryProps) {
  const { hasXeroConnection } = useAuth();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [filteredImports, setFilteredImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingFromXero, setFetchingFromXero] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showXeroDialog, setShowXeroDialog] = useState(false);
  
  // Filter states
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [typeFilter, setTypeFilter] = useState<'all' | 'manual' | 'api'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'processing'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch import history
  const fetchImportHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set('reportType', reportType);
      params.set('limit', '100');
      
      console.log('[ReportDataHistory] Fetching import history:', {
        reportType,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(`/api/v1/reports/import-history?${params}`);
      if (!response.ok) {
        console.error('[ReportDataHistory] Failed to fetch:', {
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString()
        });
        throw new Error('Failed to fetch import history');
      }
      
      const data = await response.json();
      
      console.log('[ReportDataHistory] Import history API response:', {
        count: data.imports?.length || 0,
        imports: data.imports,
        timestamp: new Date().toISOString()
      });
      
      // Transform the data
      const transformedImports: ImportRecord[] = (data.imports || []).map((imp: any) => ({
        id: imp.id,
        dateTime: new Date(imp.importedAt),
        type: ['csv', 'excel', 'file', 'manual'].includes(imp.source?.toLowerCase()) ? 'manual' : 'api',
        status: imp.status?.toLowerCase() === 'completed' ? 'success' : (imp.status?.toLowerCase() || 'success'),
        recordsImported: imp.recordCount || 0,
        fileName: imp.fileName,
        reportType: imp.reportType,
        periodStart: imp.periodStart ? new Date(imp.periodStart) : undefined,
        periodEnd: new Date(imp.periodEnd),
        importedBy: imp.importedBy,
        errors: imp.errors,
        metadata: imp.metadata
      }));
      
      // Also fetch API fetch history - skip for now as endpoint doesn't exist yet
      // TODO: Implement API history endpoint when needed
      /*
      const apiHistoryResponse = await fetch(`/api/v1/reports/api-history?reportType=${reportType}`);
      if (apiHistoryResponse.ok) {
        const apiData = await apiHistoryResponse.json();
        const apiImports: ImportRecord[] = (apiData.history || []).map((item: any) => ({
          id: `api-${item.id}`,
          dateTime: new Date(item.fetchedAt),
          type: 'api' as const,
          status: 'success' as const,
          recordsImported: item.recordCount || 0,
          reportType: item.reportType,
          periodStart: item.periodStart ? new Date(item.periodStart) : undefined,
          periodEnd: new Date(item.periodEnd),
          importedBy: 'System',
          metadata: item.metadata
        }));
        
        transformedImports.push(...apiImports);
      }
      */
      
      // Sort by periodEnd descending (most recent period first)
      transformedImports.sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
      
      console.log('[ReportDataHistory] Import history fetched:', {
        count: transformedImports.length,
        timestamp: new Date().toISOString()
      });
      
      setImports(transformedImports);
      setFilteredImports(transformedImports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load import history');
      console.error('[ReportDataHistory] Error fetching import history:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    fetchImportHistory();
  }, [fetchImportHistory]);

  // Apply filters
  useEffect(() => {
    let filtered = [...imports];
    
    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(item => item.dateTime >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(item => item.dateTime <= dateRange.to!);
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.fileName?.toLowerCase().includes(searchLower) ||
        item.importedBy.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredImports(filtered);
  }, [imports, typeFilter, statusFilter, dateRange, searchTerm]);

  const handleRefresh = async () => {
    await fetchImportHistory();
  };

  const handleFetchFromXero = async (params?: { date?: string; periods?: number; timeframe?: 'MONTH' | 'QUARTER' | 'YEAR' }) => {
    setFetchingFromXero(true);
    setShowLoadingOverlay(true);
    console.log('[ReportDataHistory] Starting Xero fetch:', {
      reportType,
      params,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Map report types to API endpoints
      const apiEndpoints: Record<string, string> = {
        'BALANCE_SHEET': '/api/v1/xero/reports/balance-sheet',
        'PROFIT_LOSS': '/api/v1/xero/reports/profit-loss',
        'CASH_FLOW': '/api/v1/xero/reports/cash-flow',
        'TRIAL_BALANCE': '/api/v1/xero/reports/trial-balance',
        'AGED_RECEIVABLES': '/api/v1/xero/reports/aged-receivables',
        'AGED_PAYABLES': '/api/v1/xero/reports/aged-payables',
        'GENERAL_LEDGER': '/api/v1/xero/reports/general-ledger',
        'BANK_SUMMARY': '/api/v1/xero/reports/bank-summary'
      };

      const endpoint = apiEndpoints[reportType];
      if (!endpoint) {
        throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Build query params
      const queryParams = new URLSearchParams();
      queryParams.set('refresh', 'true'); // Always force refresh when manually fetching
      
      if (params?.date) {
        queryParams.set('date', params.date);
      }
      if (params?.periods) {
        queryParams.set('periods', params.periods.toString());
      }
      if (params?.timeframe) {
        queryParams.set('timeframe', params.timeframe);
      }

      const fullEndpoint = `${endpoint}?${queryParams.toString()}`;
      console.log('[ReportDataHistory] Fetching from endpoint:', fullEndpoint);
      
      const response = await fetch(fullEndpoint);
      const data = await response.json();
      console.log('[ReportDataHistory] API response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch from Xero (${response.status})`);
      }

      // Refresh the import history to show the new API fetch
      console.log('[ReportDataHistory] Refreshing import history after Xero fetch...');
      await fetchImportHistory();
      console.log('[ReportDataHistory] Import history refreshed');
      
      // If onRefresh callback is provided, call it to refresh the parent component
      if (onRefresh) {
        await onRefresh();
      }
      
      console.log('[ReportDataHistory] Xero fetch successful:', {
        reportType,
        params,
        timestamp: new Date().toISOString()
      });
      
      toast.success('Successfully fetched latest data from Xero', {
        duration: 5000,
        icon: '✅',
        style: {
          background: '#10B981',
          color: '#fff',
          fontSize: '16px',
          fontWeight: 'bold',
        },
      });
    } catch (error) {
      console.error('[ReportDataHistory] Xero fetch failed:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof Error && error.message.includes('401')) {
        toast.error('Not authenticated. Please connect to Xero first.');
      } else if (error instanceof Error && error.message.includes('No balance sheet data available')) {
        toast.error('No data available. Please import data first.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to fetch from Xero');
      }
    } finally {
      setFetchingFromXero(false);
      setShowLoadingOverlay(false);
    }
  };

  const handleOpenXeroDialog = () => {
    setShowXeroDialog(true);
  };

  // Check if data exists for a given date
  const checkExistingData = useCallback(async (date: string): Promise<boolean> => {
    try {
      // Calculate period start and end based on the date
      const selectedDate = new Date(date);
      let periodStart: Date;
      let periodEnd: Date;

      if (reportType === 'BALANCE_SHEET') {
        // Balance Sheet: Always from Jan 1 to selected date
        periodStart = new Date(selectedDate.getFullYear(), 0, 1);
        periodEnd = selectedDate;
      } else {
        // P&L and other reports: Monthly period
        periodStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        periodEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      }

      // Check if we have data for this period
      const existing = imports.find(imp => {
        if (!imp.periodStart || !imp.periodEnd) return false;
        return imp.periodStart.getTime() === periodStart.getTime() && 
               imp.periodEnd.getTime() === periodEnd.getTime() &&
               imp.status === 'success';
      });

      return !!existing;
    } catch (error) {
      console.error('Error checking existing data:', error);
      return false;
    }
  }, [imports, reportType]);

  const handleDelete = async (importId: string) => {
    try {
      const response = await fetch(`/api/v1/reports/import-history?id=${importId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete import');
      }
      
      setImports(prev => prev.filter(item => item.id !== importId));
      toast.success('Import deleted successfully');
    } catch (error) {
      console.error('Failed to delete import:', error);
      toast.error('Failed to delete import');
    }
  };

  const handleViewDetails = (importId: string) => {
    // Find the import record
    const importRecord = imports.find(item => item.id === importId);
    if (!importRecord) return;
    
    // If onSelectReport is provided, call it
    if (onSelectReport) {
      onSelectReport(importRecord);
    }
    
    // Skip API-only imports as they don't have detailed data
    if (importId.startsWith('api-')) {
      toast.info('API imports do not have detailed data to view');
      return;
    }
    
    setSelectedImportId(importId);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const csvData = [
      ['Period Start', 'Period End', 'Days', 'Import Date/Time', 'Source', 'Status', 'Records', 'File Name', 'Imported By'],
      ...filteredImports.map(item => {
        const startDate = item.periodStart || new Date(item.periodEnd.getFullYear(), 0, 1);
        const days = Math.floor((item.periodEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        return [
          format(startDate, 'MMM d yyyy'),
          format(item.periodEnd, 'MMM d yyyy'),
          days.toString(),
          format(item.dateTime, 'MMM d yyyy h:mm a'),
          item.type === 'manual' ? 'File Import' : 'API',
          item.status.toUpperCase(),
          item.recordsImported.toString(),
          item.type === 'manual' && item.fileName ? item.fileName : '-',
          item.importedBy
        ];
      })
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}-import-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'periodStart',
      header: 'Period Start',
      accessor: 'periodStart',
      cell: (item: ImportRecord) => {
        const startDate = item.periodStart || new Date(item.periodEnd.getFullYear(), 0, 1);
        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="font-medium text-white whitespace-nowrap">
              {format(startDate, 'MMM d yyyy')}
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {format(startDate, 'MMM yyyy')}
            </div>
          </div>
        );
      },
      sortable: true,
      className: 'w-[140px]'
    },
    {
      key: 'periodEnd',
      header: 'Period End',
      accessor: 'periodEnd',
      cell: (item: ImportRecord) => (
        <div className="space-y-1 min-w-[120px]">
          <div className="font-medium text-white whitespace-nowrap">
            {format(item.periodEnd, 'MMM d yyyy')}
          </div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {format(item.periodEnd, 'MMM yyyy')}
          </div>
        </div>
      ),
      sortable: true,
      className: 'w-[140px]'
    },
    {
      key: 'days',
      header: 'Days',
      accessor: 'periodEnd',
      cell: (item: ImportRecord) => {
        // Calculate days in the period
        const startDate = item.periodStart || new Date(item.periodEnd.getFullYear(), 0, 1);
        const endDate = item.periodEnd;
        const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        return (
          <div className="text-center min-w-[60px]">
            <span className="font-medium text-white tabular-nums">{days}</span>
            <div className="text-xs text-gray-500">days</div>
          </div>
        );
      },
      sortable: true,
      align: 'center' as const,
      className: 'w-[80px]'
    },
    {
      key: 'dateTime',
      header: 'Imported',
      accessor: 'dateTime',
      cell: (item: ImportRecord) => (
        <div className="space-y-1 min-w-[100px]">
          <div className="text-sm text-gray-300 whitespace-nowrap">
            {format(item.dateTime, 'MMM d')}
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {format(item.dateTime, 'h:mm a')}
          </div>
        </div>
      ),
      sortable: true,
      className: 'w-[100px]'
    },
    {
      key: 'type',
      header: 'Source',
      accessor: 'type',
      cell: (item: ImportRecord) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          {item.type === 'manual' ? (
            <>
              <Upload className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-blue-400 font-medium hidden sm:inline">File Import</span>
              <span className="text-blue-400 font-medium sm:hidden">File</span>
            </>
          ) : (
            <>
              <Database className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <span className="text-purple-400 font-medium">API</span>
            </>
          )}
        </div>
      ),
      sortable: true,
      className: 'w-[100px] sm:w-[140px]'
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      cell: (item: ImportRecord) => (
        <div className="flex items-center gap-2 min-w-[90px]">
          {item.status === 'success' ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
              <span className="text-green-400 hidden sm:inline">Success</span>
            </>
          ) : item.status === 'failed' ? (
            <>
              <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span className="text-red-400 hidden sm:inline">Failed</span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-yellow-400 animate-spin flex-shrink-0" />
              <span className="text-yellow-400 hidden sm:inline">Processing</span>
            </>
          )}
        </div>
      ),
      sortable: true,
      className: 'w-[60px] sm:w-[110px]'
    },
    {
      key: 'recordsImported',
      header: 'Records',
      accessor: 'recordsImported',
      cell: (item: ImportRecord) => (
        <span className="font-medium text-white tabular-nums">
          {formatNumber(item.recordsImported)}
        </span>
      ),
      sortable: true,
      align: 'right' as const,
      className: 'w-[80px] sm:w-[100px]'
    },
    {
      key: 'fileName',
      header: 'File',
      accessor: 'fileName',
      cell: (item: ImportRecord) => {
        // Only show filename for manual file imports
        if (item.type === 'manual' && item.fileName) {
          return (
            <div className="space-y-1 min-w-[120px] max-w-[200px] sm:max-w-[300px]">
              <div className="flex items-center gap-2 group">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-white truncate" title={item.fileName}>
                  {item.fileName}
                </span>
              </div>
              {item.errors && item.errors.length > 0 && (
                <div className="text-xs text-red-400">
                  {item.errors.length} error(s)
                </div>
              )}
            </div>
          );
        }
        // For API imports, show "API"
        return <span className="text-purple-400 font-medium">API</span>;
      },
      className: 'hidden md:table-cell'
    },
    {
      key: 'importedBy',
      header: 'By',
      accessor: 'importedBy',
      cell: (item: ImportRecord) => (
        <span className="text-gray-300 truncate max-w-[100px]" title={item.importedBy}>
          {item.importedBy}
        </span>
      ),
      className: 'hidden lg:table-cell'
    },
    {
      key: 'actions',
      header: '',
      accessor: 'id',
      cell: (item: ImportRecord) => (
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => handleViewDetails(item.id)}
            className="p-2 sm:p-1.5 hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
            title="View details"
          >
            <Eye className="h-4 w-4 text-gray-400" />
          </button>
          {item.type === 'manual' && (
            <button
              onClick={() => handleDelete(item.id)}
              className="p-2 sm:p-1.5 hover:bg-red-500/10 rounded-lg transition-colors touch-manipulation"
              title="Delete import"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          )}
        </div>
      ),
      align: 'right' as const,
      className: 'w-[80px] sm:w-[100px]'
    }
  ];

  if (loading) {
    return (
      <div className={cn("container mx-auto px-4 py-6 sm:py-8", className)}>
        <UnifiedPageHeader 
          title={reportTitle}
          description={reportDescription || "Import and API fetch history"}
          showAuthStatus={true}
          showBreadcrumbs={true}
          breadcrumbItems={[
            { label: 'Reports', href: '/reports' },
            { label: reportTitle }
          ]}
          actions={
            <div className="flex items-center gap-2 sm:gap-3">
              <a 
                href={`/reports/import?type=${reportType}`}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm sm:text-base"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import Data</span>
                <span className="sm:hidden">Import</span>
              </a>
              <div className="relative group">
                <button 
                  disabled
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600/30 text-white/40 rounded-lg transition-colors text-sm sm:text-base cursor-not-allowed"
                >
                  {hasXeroConnection ? (
                    <Cloud className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Fetch from Xero</span>
                  <span className="sm:hidden">Fetch</span>
                </button>
                {!hasXeroConnection && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    Connect to Xero to enable this feature
                  </div>
                )}
              </div>
            </div>
          }
        />
        <div className="animate-pulse space-y-6">
          {/* Filters skeleton */}
          <div className="bg-secondary border border-default rounded-2xl p-4 sm:p-6">
            <div className="h-6 w-24 bg-gray-700 rounded mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 w-16 bg-gray-700 rounded mb-2" />
                  <div className="h-10 bg-gray-800 border border-gray-700 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Table skeleton */}
          <div className="bg-secondary border border-default rounded-2xl overflow-hidden">
            <div className="bg-gray-800/50 border-b border-gray-700 px-4 py-3">
              <div className="flex gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-700 rounded flex-1" />
                ))}
              </div>
            </div>
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-t border-gray-700 px-4 py-4">
                  <div className="flex gap-4">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="h-4 bg-gray-700 rounded flex-1" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("container mx-auto px-4 py-6 sm:py-8", className)}>
        <UnifiedPageHeader 
          title={reportTitle}
          description={reportDescription || "Import and API fetch history"}
          showAuthStatus={true}
          showBreadcrumbs={true}
          breadcrumbItems={[
            { label: 'Reports', href: '/reports' },
            { label: reportTitle }
          ]}
          actions={
            <div className="flex items-center gap-2 sm:gap-3">
              <a 
                href={`/reports/import?type=${reportType}`}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm sm:text-base"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import Data</span>
                <span className="sm:hidden">Import</span>
              </a>
              <div className="relative group">
                <button 
                  disabled
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600/30 text-white/40 rounded-lg transition-colors text-sm sm:text-base cursor-not-allowed"
                >
                  {hasXeroConnection ? (
                    <Cloud className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Fetch from Xero</span>
                  <span className="sm:hidden">Fetch</span>
                </button>
                {!hasXeroConnection && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    Connect to Xero to enable this feature
                  </div>
                )}
              </div>
            </div>
          }
        />
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 sm:p-12 text-center">
          <div className="bg-red-500/10 rounded-full p-4 w-fit mx-auto mb-4">
            <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Unable to load import history</h3>
          <p className="text-sm text-red-400 mb-6 max-w-md mx-auto">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto px-4 py-6 sm:py-8", className)}>
      <UnifiedPageHeader 
        title={reportTitle}
        description={reportDescription || "Import and API fetch history"}
        showBreadcrumbs={true}
        breadcrumbItems={[
          { label: 'Reports', href: '/reports' },
          { label: reportTitle }
        ]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <a 
              href={`/reports/import?type=${reportType}`}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import Data</span>
              <span className="sm:hidden">Import</span>
            </a>
            <div className="relative group">
              <button 
                onClick={handleOpenXeroDialog}
                disabled={fetchingFromXero || !hasXeroConnection}
                className={cn(
                  "inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base",
                  hasXeroConnection 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50" 
                    : "bg-emerald-600/30 text-white/40 cursor-not-allowed"
                )}
              >
                {hasXeroConnection ? (
                  <Cloud className={`h-4 w-4 ${fetchingFromXero ? 'animate-pulse' : ''}`} />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Fetch from Xero</span>
                <span className="sm:hidden">Fetch</span>
              </button>
              {!hasXeroConnection && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                  Connect to Xero to enable this feature
                </div>
              )}
            </div>
            <button 
              onClick={handleExport}
              disabled={filteredImports.length === 0}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-emerald hover:bg-brand-emerald/80 disabled:opacity-50 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <h3 className="text-lg font-semibold text-white">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files or users..."
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue transition-colors"
            />
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Source</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue transition-colors appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All Sources</option>
              <option value="manual">File Import</option>
              <option value="api">API</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue transition-colors appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-2">Date Range</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={dateRange.from?.toISOString().split('T')[0] || ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : undefined }))}
                className="w-full sm:w-auto sm:min-w-[140px] px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue transition-colors"
                aria-label="Start date"
              />
              <span className="text-gray-400 self-center hidden sm:block">to</span>
              <input
                type="date"
                value={dateRange.to?.toISOString().split('T')[0] || ''}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value) : undefined }))}
                className="w-full sm:w-auto sm:min-w-[140px] px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue transition-colors"
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span className="text-sm text-gray-400">
            Showing {filteredImports.length} of {imports.length} imports
          </span>
          {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || dateRange.from || dateRange.to) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setStatusFilter('all');
                setDateRange({});
              }}
              className="text-sm text-brand-blue hover:text-brand-blue/80 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="relative">
        <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl overflow-hidden">
          {filteredImports.length === 0 ? (
            <div className="p-12 sm:p-16 text-center">
              <div className="bg-gray-800/50 rounded-full p-4 w-fit mx-auto mb-4">
                <Database className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No imports found</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || dateRange.from || dateRange.to
                  ? 'Try adjusting your filters to see more results'
                  : 'Import data from files or fetch from API to see history here'}
              </p>
              {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || dateRange.from || dateRange.to) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                    setDateRange({});
                  }}
                  className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-px">
              <DataTable
                data={filteredImports}
                columns={columns}
                isLoading={loading}
                emptyMessage="No import history found"
                rowKey="id"
                stickyHeader={true}
                className="border-0"
              />
            </div>
          )}
        </div>
        
        {/* Mobile scroll indicator */}
        {filteredImports.length > 0 && (
          <div className="sm:hidden absolute right-0 top-1/2 -translate-y-1/2 bg-gradient-to-l from-gray-900 to-transparent px-2 py-4 pointer-events-none">
            <ChevronRight className="h-5 w-5 text-gray-400 animate-pulse" />
          </div>
        )}
      </div>
      
      {/* Import Details Modal */}
      {selectedImportId && (
        <ImportDetailsModal
          importId={selectedImportId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedImportId(null);
          }}
        />
      )}
      
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-secondary border border-default rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                <Cloud className="h-16 w-16 text-emerald-400 relative animate-bounce" />
              </div>
              <h3 className="text-xl font-semibold text-white">Fetching from Xero</h3>
              <p className="text-gray-400 text-center">
                Please wait while we retrieve the latest {reportTitle.toLowerCase()} data from your Xero account...
              </p>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Connecting to Xero API...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Xero Fetch Dialog */}
      <XeroFetchDialog
        isOpen={showXeroDialog}
        onClose={() => setShowXeroDialog(false)}
        onConfirm={handleFetchFromXero}
        reportType={reportType}
        reportTitle={reportTitle}
        existingDataCheck={checkExistingData}
      />
    </div>
  );
}