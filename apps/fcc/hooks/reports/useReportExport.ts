import { useState, useCallback } from 'react';
import { structuredLogger } from '@/lib/client-safe-logger';

interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((item: T) => string | number);
}

interface UseReportExportOptions<T> {
  filename: string;
  columns: ExportColumn<T>[];
  data: T[] | null;
  transformData?: (data: T[]) => any[];
}

interface UseReportExportReturn {
  exporting: boolean;
  exportToCSV: () => Promise<void>;
}

export function useReportExport<T>({
  filename,
  columns,
  data,
  transformData,
}: UseReportExportOptions<T>): UseReportExportReturn {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = useCallback(async () => {
    if (!data || data.length === 0) {
      structuredLogger.warn('[useReportExport] No data to export');
      return;
    }

    setExporting(true);
    
    try {
      structuredLogger.info('[useReportExport] Starting export', { filename, rowCount: data.length });

      // Transform data if transformer provided
      const exportData = transformData ? transformData(data) : data;

      // Create CSV header
      const headers = columns.map(col => col.header).join(',');
      
      // Create CSV rows
      const rows = exportData.map(item => {
        return columns.map(col => {
          let value: any;
          
          if (typeof col.accessor === 'function') {
            value = col.accessor(item);
          } else {
            value = item[col.accessor];
          }

          // Handle special cases
          if (value === null || value === undefined) {
            return '';
          }
          
          // Escape quotes and wrap in quotes if contains comma or newline
          if (typeof value === 'string') {
            const escaped = value.replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
              return `"${escaped}"`;
            }
            return escaped;
          }
          
          return value.toString();
        }).join(',');
      });

      // Combine header and rows
      const csv = [headers, ...rows].join('\n');

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      structuredLogger.info('[useReportExport] Export completed successfully', { filename });
    } catch (error) {
      structuredLogger.error('[useReportExport] Export failed', { filename, error });
      throw error;
    } finally {
      setExporting(false);
    }
  }, [data, columns, filename, transformData]);

  return {
    exporting,
    exportToCSV,
  };
}