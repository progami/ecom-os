'use client';

import { FileX, RefreshCw, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReportEmptyStateProps {
  reportName: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  error?: boolean;
}

export function ReportEmptyState({ 
  reportName, 
  onRefresh,
  isLoading = false,
  error = false
}: ReportEmptyStateProps) {
  const router = useRouter();
  
  return (
    <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-12 text-center">
      <div className="max-w-md mx-auto">
        {/* Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-slate-700/30 rounded-full animate-pulse" />
          <div className="relative w-full h-full flex items-center justify-center">
            <FileX className="h-10 w-10 text-slate-400" />
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-semibold text-white mb-3">
          No Data Available
        </h3>
        
        {/* Description */}
        <p className="text-base text-slate-400 mb-8 leading-relaxed">
          {error 
            ? `Unable to load ${reportName} data. Please try again or contact support if the issue persists.`
            : `No ${reportName} data found for the selected period. Try syncing with Xero or adjusting your date filters.`
          }
        </p>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync with Xero</span>
            </button>
          )}
          
          <button 
            onClick={() => router.push('/reports/import')}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-brand-emerald hover:bg-brand-emerald/80 text-white rounded-lg transition-colors font-medium"
          >
            <Upload className="h-4 w-4" />
            <span>Import Report Data</span>
          </button>
        </div>
        
        {/* Help Text */}
        <p className="mt-8 text-sm text-slate-500">
          You can sync data directly from Xero or import report data from a file.
        </p>
      </div>
    </div>
  );
}