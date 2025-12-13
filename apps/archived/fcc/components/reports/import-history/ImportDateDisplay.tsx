'use client'

import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { ImportDateDisplayProps, REPORT_DATE_FORMATS } from './types'
import { cn } from '@/lib/utils'

export function ImportDateDisplay({ 
  reportType, 
  periodStart, 
  periodEnd, 
  className 
}: ImportDateDisplayProps) {
  const dateConfig = REPORT_DATE_FORMATS[reportType]
  
  const formatDate = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    switch (dateConfig.displayFormat) {
      case 'ytd':
        // For YTD reports, show "Jan 1 - Dec 31, YYYY"
        const year = date.getFullYear()
        return `Jan 1 - ${format(date, 'MMM d, yyyy')}`
      
      case 'month':
        // For monthly reports, show "Month YYYY"
        return format(date, 'MMMM yyyy')
      
      case 'point-in-time':
        // For point-in-time reports, show single date
        return format(date, 'MMM d, yyyy')
      
      case 'period':
        // For period reports, show date range
        if (periodStart && periodEnd) {
          const startDate = new Date(periodStart)
          const endDate = new Date(periodEnd)
          
          // Check if same month/year
          if (startDate.getMonth() === endDate.getMonth() && 
              startDate.getFullYear() === endDate.getFullYear()) {
            return `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`
          }
          
          // Check if same year
          if (startDate.getFullYear() === endDate.getFullYear()) {
            return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
          }
          
          // Different years
          return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
        }
        return format(date, 'MMM d, yyyy')
      
      default:
        return format(date, 'MMM d, yyyy')
    }
  }
  
  // Determine which date to use based on report type
  const displayDate = dateConfig.displayFormat === 'point-in-time' || 
                     dateConfig.displayFormat === 'ytd' || 
                     dateConfig.displayFormat === 'month'
    ? periodEnd 
    : null
  
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Calendar className="h-4 w-4 text-gray-400" />
      <span className="text-gray-400">{dateConfig.label}:</span>
      <span className="font-medium text-gray-200">
        {displayDate ? formatDate(displayDate) : formatDate(periodEnd)}
      </span>
    </div>
  )
}