// Shared table styling configuration for consistent appearance across the app

export const tableStyles = {
  // Base table classes
  table: "w-full border-collapse",
  wrapper: "w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700",
  
  // Header styles
  headerRow: "bg-gray-50 dark:bg-gray-800",
  headerCell: "px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 text-left border-b border-gray-200 dark:border-gray-700",
  
  // Body styles
  bodyRow: "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
  bodyCell: "px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700",
  
  // Cell type styles
  cellTypes: {
    // Editable cells - distinct white background with border
    editable: "bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer transition-colors border border-gray-300 dark:border-gray-600",
    editableActive: "bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-500",
    
    // Calculated/readonly cells - gray background, no border
    calculated: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    
    // Summary/total cells
    summary: "bg-gray-100 dark:bg-gray-800 font-semibold",
    
    // Status-based cells
    positive: "text-green-600 dark:text-green-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
  },
  
  // Input styles for editing
  input: "w-full h-7 px-2 py-0.5 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
  
  // Empty state
  emptyState: "p-8 text-center text-gray-500 dark:text-gray-400",
}

// Column style helpers
export const getColumnClassName = (
  type: 'editable' | 'calculated' | 'summary' | 'readonly',
  additionalClasses?: string
): string => {
  const baseClass = tableStyles.bodyCell
  const typeClass = type === 'editable' ? tableStyles.cellTypes.editable :
                    type === 'calculated' ? tableStyles.cellTypes.calculated :
                    type === 'summary' ? tableStyles.cellTypes.summary : ''
  
  return `${baseClass} ${typeClass} ${additionalClasses || ''}`.trim()
}

// Value-based cell styling
export const getValueClassName = (value: number, type: 'margin' | 'variance' | 'general' = 'general'): string => {
  if (type === 'margin') {
    if (value >= 30) return tableStyles.cellTypes.positive
    if (value >= 20) return tableStyles.cellTypes.warning
    return tableStyles.cellTypes.negative
  }
  
  if (type === 'variance') {
    if (Math.abs(value) < 5) return ''
    return value > 0 ? tableStyles.cellTypes.negative : tableStyles.cellTypes.positive
  }
  
  // General positive/negative
  if (value > 0) return tableStyles.cellTypes.positive
  if (value < 0) return tableStyles.cellTypes.negative
  return ''
}