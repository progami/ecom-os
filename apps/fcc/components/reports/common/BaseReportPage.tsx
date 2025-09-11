import React from 'react';
import { UnifiedPageHeader } from '@/components/ui/unified-page-header';
import { ReportEmptyState } from '@/components/reports/report-empty-state';
import { ReportErrorBoundary } from '@/components/ui/report-error-boundary';
import { ReportMetricsGrid, ReportMetric } from './ReportMetricsGrid';
import { ReportChartsGrid } from './ReportChartsGrid';
import { ReportActionsHeader } from './ReportActionsHeader';
import { structuredLogger } from '@/lib/logger';

export interface BaseReportPageProps {
  // Header props
  title: string;
  description: string;
  breadcrumbLabel: string;
  
  // Data state
  loading: boolean;
  error: Error | null;
  hasData: boolean;
  
  // Actions
  onRefresh: () => void;
  onExport?: () => void;
  refreshing?: boolean;
  exporting?: boolean;
  
  // Content sections
  metrics?: ReportMetric[];
  charts?: React.ReactNode;
  table?: React.ReactNode;
  insights?: React.ReactNode;
  footer?: React.ReactNode;
  
  // Customization
  headerActions?: React.ReactNode;
  showFilter?: boolean;
  onFilterOpen?: () => void;
  emptyStateProps?: {
    message?: string;
    submessage?: string;
    actionLabel?: string;
    showImportOption?: boolean;
  };
}

export function BaseReportPage({
  // Header props
  title,
  description,
  breadcrumbLabel,
  
  // Data state
  loading,
  error,
  hasData,
  
  // Actions
  onRefresh,
  onExport,
  refreshing = false,
  exporting = false,
  
  // Content sections
  metrics = [],
  charts,
  table,
  insights,
  footer,
  
  // Customization
  headerActions,
  showFilter = false,
  onFilterOpen,
  emptyStateProps = {},
}: BaseReportPageProps) {
  React.useEffect(() => {
    structuredLogger.info(`[BaseReportPage] Rendering ${title}`, {
      loading,
      hasError: !!error,
      hasData,
    });
  }, [title, loading, error, hasData]);

  // Show loading skeleton
  if (loading && !hasData) {
    return (
      <ReportErrorBoundary>
        <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <UnifiedPageHeader
            title={title}
            description={description}
            breadcrumbLabel={breadcrumbLabel}
            actions={
              <ReportActionsHeader
                showRefresh={false}
                showExport={false}
              />
            }
          />
          
          {metrics.length > 0 && (
            <ReportMetricsGrid 
              metrics={metrics} 
              loading={true}
              columns={metrics.length as 1 | 2 | 3 | 4}
            />
          )}
          
          {charts && (
            <ReportChartsGrid loading={true}>
              {charts}
            </ReportChartsGrid>
          )}
        </div>
      </ReportErrorBoundary>
    );
  }

  // Show error or empty state
  if (error || !hasData) {
    return (
      <ReportErrorBoundary>
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <UnifiedPageHeader
            title={title}
            description={description}
            breadcrumbLabel={breadcrumbLabel}
          />
          <ReportEmptyState
            error={error}
            onRefresh={onRefresh}
            refreshing={refreshing}
            message={emptyStateProps.message}
            submessage={emptyStateProps.submessage}
            actionLabel={emptyStateProps.actionLabel}
            showImportOption={emptyStateProps.showImportOption}
          />
        </div>
      </ReportErrorBoundary>
    );
  }

  // Render full report
  return (
    <ReportErrorBoundary>
      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <UnifiedPageHeader
          title={title}
          description={description}
          breadcrumbLabel={breadcrumbLabel}
          actions={
            <ReportActionsHeader
              onRefresh={onRefresh}
              onExport={onExport}
              onFilterOpen={onFilterOpen}
              refreshing={refreshing}
              exporting={exporting}
              showFilter={showFilter}
              showExport={!!onExport}
              additionalActions={headerActions}
            />
          }
        />
        
        {/* Metrics Section */}
        {metrics.length > 0 && (
          <section>
            <ReportMetricsGrid 
              metrics={metrics}
              columns={metrics.length as 1 | 2 | 3 | 4}
            />
          </section>
        )}
        
        {/* Charts Section */}
        {charts && (
          <section>
            <ReportChartsGrid>
              {charts}
            </ReportChartsGrid>
          </section>
        )}
        
        {/* Insights Section */}
        {insights && (
          <section>
            {insights}
          </section>
        )}
        
        {/* Table Section */}
        {table && (
          <section className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
            {table}
          </section>
        )}
        
        {/* Footer Section */}
        {footer && (
          <section>
            {footer}
          </section>
        )}
      </div>
    </ReportErrorBoundary>
  );
}