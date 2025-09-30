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
}

export const SHEETS: SheetConfig[] = [
  {
    slug: '1-product-setup',
    label: '1. Product Setup',
    description: 'SKU pricing, cost inputs, and lead-time defaults.',
  },
  {
    slug: '2-ops-planning',
    label: '2. Ops Planning',
    description: 'Purchase orders, supplier payments, and logistics tracking.',
  },
  {
    slug: '3-sales-planning',
    label: '3. Sales Planning',
    description: 'Weekly sales forecast and inventory coverage by SKU.',
  },
  {
    slug: '4-fin-planning-pl',
    label: '4. Fin Planning P&L',
    description: 'Weekly profitability and monthly rollups.',
  },
  {
    slug: '5-fin-planning-cash-flow',
    label: '5. Fin Planning Cash Flow',
    description: 'Cash movement, payouts, and runway visibility.',
  },
]

export function getSheetConfig(slug: string): SheetConfig | undefined {
  return SHEETS.find((sheet) => sheet.slug === slug)
}

