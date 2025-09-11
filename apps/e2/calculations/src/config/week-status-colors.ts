// Centralized configuration for week status colors
export const WEEK_STATUS_COLORS = {
  // Past reconciled weeks - blue accent
  reconciled: {
    row: '',
    cell: 'bg-blue-100 dark:bg-blue-900/40',
    indicator: 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500',
    text: 'text-blue-700 dark:text-blue-300 font-medium',
    label: 'Reconciled (Historical)'
  },
  
  // Current week - green accent
  current: {
    row: '',
    cell: 'bg-green-100 dark:bg-green-900/40',
    indicator: 'bg-green-100 dark:bg-green-900/40 border-2 border-green-500',
    text: 'text-green-700 dark:text-green-300 font-medium',
    label: 'Current Week'
  },
  
  // Future weeks - subtle indication
  future: {
    row: '',
    cell: '',
    indicator: 'bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-400',
    text: 'text-purple-700 dark:text-purple-300',
    label: 'Forecast'
  },
  
  // Default/normal weeks
  default: {
    row: '',
    cell: '',
    indicator: 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800',
    text: '',
    label: 'Actual'
  }
};

// Helper function to get week status colors
export function getWeekStatusColors(isPastReconciled: boolean, isCurrentWeek: boolean, isFuture: boolean) {
  if (isPastReconciled) return WEEK_STATUS_COLORS.reconciled;
  if (isCurrentWeek) return WEEK_STATUS_COLORS.current;
  if (isFuture) return WEEK_STATUS_COLORS.future;
  return WEEK_STATUS_COLORS.default;
}