import { StorageCostSummary } from './StorageCostSummary'
import type { StorageSummary } from '@/hooks/useStorageLedger'

interface StorageLedgerStatsProps {
  summary: StorageSummary
}

export function StorageLedgerStats({ summary }: StorageLedgerStatsProps) {
  return <StorageCostSummary summary={summary} />
}