import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Filter } from 'lucide-react';

interface ReportActionsHeaderProps {
  onRefresh?: () => void;
  onExport?: () => void;
  onFilterOpen?: () => void;
  refreshing?: boolean;
  exporting?: boolean;
  showRefresh?: boolean;
  showExport?: boolean;
  showFilter?: boolean;
  additionalActions?: React.ReactNode;
}

export function ReportActionsHeader({
  onRefresh,
  onExport,
  onFilterOpen,
  refreshing = false,
  exporting = false,
  showRefresh = true,
  showExport = true,
  showFilter = false,
  additionalActions,
}: ReportActionsHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {showFilter && onFilterOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFilterOpen}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      )}
      
      {additionalActions}
      
      {showExport && onExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={exporting}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      )}
      
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      )}
    </div>
  );
}