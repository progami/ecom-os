import type { LucideIcon } from 'lucide-react'
import { ClipboardList, FileSpreadsheet, LineChart, Package, Wallet2 } from 'lucide-react'

export type SheetSlug =
  | '1-product-setup'
  | '2-ops-planning'
  | '3-sales-planning'
  | '4-fin-planning-pl'
  | '5-fin-planning-cash-flow'

export interface SheetConfig {
  slug: SheetSlug
  label: string
  description: string
  icon: LucideIcon
}

export const SHEETS: SheetConfig[] = [
  {
    slug: '1-product-setup',
    label: 'Product Setup',
    description: 'SKU pricing, cost inputs, and lead-time defaults.',
    icon: Package,
  },
  {
    slug: '2-ops-planning',
    label: 'Ops Planning',
    description: 'Purchase orders, supplier payments, and logistics tracking.',
    icon: ClipboardList,
  },
  {
    slug: '3-sales-planning',
    label: 'Sales Planning',
    description: 'Weekly sales forecast and inventory coverage by SKU.',
    icon: FileSpreadsheet,
  },
  {
    slug: '4-fin-planning-pl',
    label: 'Fin P&L',
    description: 'Weekly profitability and monthly rollups.',
    icon: LineChart,
  },
  {
    slug: '5-fin-planning-cash-flow',
    label: 'Cash Flow',
    description: 'Cash movement, payouts, and runway visibility.',
    icon: Wallet2,
  },
]

export function getSheetConfig(slug: string): SheetConfig | undefined {
  return SHEETS.find((sheet) => sheet.slug === slug)
}
