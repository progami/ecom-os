'use client'

import { format } from 'date-fns'
import { FileSpreadsheet, FileText, FileJson, Database, Cloud, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { ImportHistoryItem as ImportItem, ImportHistoryItemProps, REPORT_TYPE_LABELS } from './types'
import { ImportDateDisplay } from './ImportDateDisplay'
import { ImportActions } from './ImportActions'
import { cn } from '@/lib/utils'

const SOURCE_ICONS = {
  csv: FileText,
  excel: FileSpreadsheet,
  json: FileJson,
  manual: Database,
  xero: Cloud
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10', label: 'Pending' },
  processing: { icon: Loader2, color: 'text-brand-blue', bgColor: 'bg-brand-blue/10', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-brand-emerald', bgColor: 'bg-brand-emerald/10', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Failed' }
}

export function ImportHistoryItem({
  item,
  onSelect,
  onDelete,
  onCompare,
  showActions = true,
  isSelected = false,
  isCompareMode = false,
  showReportType = true
}: ImportHistoryItemProps) {
  const SourceIcon = SOURCE_ICONS[item.source] || FileText
  const statusConfig = STATUS_CONFIG[item.status]
  const StatusIcon = statusConfig.icon
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }
  
  return (
    <div className={cn(
      "bg-secondary border border-default rounded-xl p-4 transition-all",
      isSelected && "border-brand-blue/50 bg-brand-blue/5"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header Row */}
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", statusConfig.bgColor)}>
              <SourceIcon className={cn("h-5 w-5", statusConfig.color)} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {showReportType && (
                  <span className="text-sm font-medium text-gray-200">
                    {REPORT_TYPE_LABELS[item.reportType]}
                  </span>
                )}
                
                {item.fileName && (
                  <span className="text-sm text-gray-400">
                    {item.fileName}
                  </span>
                )}
                
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs",
                  statusConfig.bgColor
                )}>
                  <StatusIcon className={cn("h-3 w-3", statusConfig.color)} />
                  <span className={statusConfig.color}>{statusConfig.label}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span>Imported {format(new Date(item.importedAt), 'MMM d, yyyy h:mm a')}</span>
                <span>by {item.importedBy}</span>
                {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                {item.recordCount && item.recordCount > 0 && <span>{item.recordCount} records</span>}
              </div>
            </div>
          </div>
          
          {/* Date Display */}
          <ImportDateDisplay
            reportType={item.reportType}
            periodStart={item.periodStart}
            periodEnd={item.periodEnd}
          />
          
          {/* Error Message */}
          {item.status === 'failed' && item.errorLog && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-2">
              <p className="text-xs text-red-400">{item.errorLog}</p>
            </div>
          )}
        </div>
        
        {/* Actions */}
        {showActions && (
          <ImportActions
            importItem={item}
            onView={onSelect ? () => onSelect(item.id) : undefined}
            onDelete={onDelete ? () => onDelete(item.id) : undefined}
            onSelect={isCompareMode && onCompare ? (selected) => onCompare(item.id) : undefined}
            isSelected={isSelected}
            disabled={item.status === 'processing'}
          />
        )}
      </div>
    </div>
  )
}