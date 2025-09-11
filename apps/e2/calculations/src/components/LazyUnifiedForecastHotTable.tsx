import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load the heavy Handsontable component
export const LazyUnifiedForecastHotTable = dynamic(
  () => import('./UnifiedForecastHotTable').then(mod => ({ default: mod.UnifiedForecastHotTable })),
  {
    loading: () => (
      <div className="p-4">
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    ),
    ssr: false // Disable SSR for Handsontable
  }
)