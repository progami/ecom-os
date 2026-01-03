import type { LucideIcon } from 'lucide-react'
import { ClipboardList, FileSpreadsheet, LineChart, Package, Target, TrendingUp, Wallet2 } from 'lucide-react'

export type SheetSlug =
  | '0-strategies'
  | '1-product-setup'
  | '2-ops-planning'
  | '3-sales-planning'
  | '4-fin-planning-pl'
  | '5-fin-planning-cash-flow'
  | '6-po-profitability'

export interface SheetConfig {
  slug: SheetSlug
  label: string
  description: string
  icon: LucideIcon
}

export const SHEETS: SheetConfig[] = [
  {
    slug: '0-strategies',
    label: 'Strategies',
    description: '',
    icon: Target,
  },
  {
    slug: '1-product-setup',
    label: 'Product Setup',
    description: '',
    icon: Package,
  },
  {
    slug: '2-ops-planning',
    label: 'Ops Planning',
    description: '',
    icon: ClipboardList,
  },
  {
    slug: '3-sales-planning',
    label: 'Sales Planning',
    description: '',
    icon: FileSpreadsheet,
  },
  {
    slug: '4-fin-planning-pl',
    label: 'P&L',
    description: '',
    icon: LineChart,
  },
  {
    slug: '5-fin-planning-cash-flow',
    label: 'Cash Flow',
    description: '',
    icon: Wallet2,
  },
  {
    slug: '6-po-profitability',
    label: 'PO Profitability',
    description: '',
    icon: TrendingUp,
  },
]

export function getSheetConfig(slug: string): SheetConfig | undefined {
  return SHEETS.find((sheet) => sheet.slug === slug)
}
