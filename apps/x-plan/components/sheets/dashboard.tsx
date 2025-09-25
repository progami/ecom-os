import type {
  CashFlowSummaryRow,
  FinancialSummaryRow,
  PipelineBucket,
} from '@/lib/calculations'

interface DashboardInventoryRow {
  productName: string
  stockEnd: number
  stockWeeks: number
}

interface DashboardData {
  overview: {
    revenueYTD: number
    netProfitYTD: number
    cashBalance: number
    netMargin: number
  }
  pipeline: PipelineBucket[]
  inventory: DashboardInventoryRow[]
  rollups: {
    profitAndLoss: {
      monthly: FinancialSummaryRow[]
      quarterly: FinancialSummaryRow[]
    }
    cashFlow: {
      monthly: CashFlowSummaryRow[]
      quarterly: CashFlowSummaryRow[]
    }
  }
}

type MetricDefinition = {
  label: string
  helper: string
  value: number
  format: 'currency' | 'percent'
  tone?: 'neutral' | 'positive' | 'negative'
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const unitFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const weeksFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function DashboardSheet({ data }: { data: DashboardData }) {
  const metrics: MetricDefinition[] = [
    {
      label: 'Revenue YTD',
      helper: 'Gross sales captured across all SKUs',
      value: data.overview.revenueYTD,
      format: 'currency',
    },
    {
      label: 'Net Profit YTD',
      helper: 'After COGS, platform fees, ad spend, and fixed costs',
      value: data.overview.netProfitYTD,
      format: 'currency',
      tone: data.overview.netProfitYTD >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Cash Balance',
      helper: 'Projected ending cash from the cash flow model',
      value: data.overview.cashBalance,
      format: 'currency',
    },
    {
      label: 'Net Margin',
      helper: 'Net profit divided by revenue',
      value: data.overview.netMargin,
      format: 'percent',
      tone: data.overview.netMargin >= 0 ? 'positive' : 'negative',
    },
  ]

  const pipelineBuckets = [...data.pipeline].sort((a, b) => b.quantity - a.quantity)
  const pipelineTotal = pipelineBuckets.reduce((sum, bucket) => sum + bucket.quantity, 0)

  const inventoryRows = [...data.inventory]
    .sort((a, b) => b.stockEnd - a.stockEnd)
    .slice(0, 6)

  const pnlMonthly = limitRows(data.rollups.profitAndLoss.monthly, 6)
  const pnlQuarterly = limitRows(data.rollups.profitAndLoss.quarterly, 4)
  const cashMonthly = limitRows(data.rollups.cashFlow.monthly, 6)
  const cashQuarterly = limitRows(data.rollups.cashFlow.quarterly, 4)

  return (
    <div className="space-y-10">
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Workbook overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor headline performance and keep planning tabs focused on data entry. Monthly and quarterly rollups now live
            here for quick reviews.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-5">
        <PipelineCard pipeline={pipelineBuckets} total={pipelineTotal} />
        <InventoryCard rows={inventoryRows} />
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Financial rollups</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Summaries moved from the grids</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review the headline revenue, profit, and cash flow trends that used to appear alongside the planning grids.
          </p>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          <RollupCard
            title="P&amp;L Rollup"
            description="Revenue, cost, and profitability"
            monthlyLabel="Monthly summary"
            monthly={pnlMonthly}
            monthlyTotal={data.rollups.profitAndLoss.monthly.length}
            quarterlyLabel="Quarterly summary"
            quarterly={pnlQuarterly}
            quarterlyTotal={data.rollups.profitAndLoss.quarterly.length}
            columns={[
              { key: 'periodLabel', label: 'Period', format: 'plain' },
              { key: 'revenue', label: 'Revenue', format: 'currency' },
              { key: 'grossProfit', label: 'Gross Profit', format: 'currency' },
              { key: 'totalOpex', label: 'Total OpEx', format: 'currency' },
              { key: 'netProfit', label: 'Net Profit', format: 'currency', highlight: true },
            ]}
          />

          <RollupCard
            title="Cash Flow Rollup"
            description="Driver cash, net movement, and ending balance"
            monthlyLabel="Monthly summary"
            monthly={cashMonthly}
            monthlyTotal={data.rollups.cashFlow.monthly.length}
            quarterlyLabel="Quarterly summary"
            quarterly={cashQuarterly}
            quarterlyTotal={data.rollups.cashFlow.quarterly.length}
            columns={[
              { key: 'periodLabel', label: 'Period', format: 'plain' },
              { key: 'amazonPayout', label: 'Amazon Payout', format: 'currency' },
              { key: 'inventorySpend', label: 'Inventory Spend', format: 'currency' },
              { key: 'netCash', label: 'Net Cash', format: 'currency', highlight: true },
              { key: 'closingCash', label: 'Closing Cash', format: 'currency' },
            ]}
          />
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, helper, value, format, tone = 'neutral' }: MetricDefinition) {
  const formatted = format === 'currency' ? formatCurrency(value) : formatPercentValue(value)
  const accentClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-slate-50'

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClass}`}>{formatted}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    </article>
  )
}

function PipelineCard({ pipeline, total }: { pipeline: PipelineBucket[]; total: number }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pipeline by status</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status mix across all open purchase orders</p>

      <div className="mt-4 space-y-3">
        {pipeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No purchase orders in the model yet.
          </div>
        ) : (
          pipeline.map((bucket) => {
            const share = total > 0 ? Math.round((bucket.quantity / total) * 100) : 0
            return (
              <div key={bucket.status}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{formatStatus(bucket.status)}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {bucket.quantity.toLocaleString()} ({share}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-sky-500 dark:bg-sky-400"
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}

function InventoryCard({ rows }: { rows: DashboardInventoryRow[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory snapshot</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Highest on-hand SKUs with weeks of cover</p>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">Showing top {rows.length} products</span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No inventory rows available yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase dark:bg-slate-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-400">Product</th>
                <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Units</th>
                <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Weeks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((item) => (
                <tr key={item.productName} className="text-slate-700 dark:text-slate-200">
                  <td className="px-3 py-2 font-medium">{item.productName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUnits(item.stockEnd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatWeeks(item.stockWeeks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}

type RollupColumn<T extends object> = {
  key: keyof T & string
  label: string
  format?: 'currency' | 'number' | 'plain'
  highlight?: boolean
}

type RollupCardProps<T extends object> = {
  title: string
  description: string
  monthlyLabel: string
  monthly: T[]
  monthlyTotal: number
  quarterlyLabel: string
  quarterly: T[]
  quarterlyTotal: number
  columns: RollupColumn<T>[]
}

function RollupCard<T extends object>({
  title,
  description,
  monthlyLabel,
  monthly,
  monthlyTotal,
  quarterlyLabel,
  quarterly,
  quarterlyTotal,
  columns,
}: RollupCardProps<T>) {
  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="space-y-4">
        <RollupTable label={monthlyLabel} rows={monthly} totalCount={monthlyTotal} columns={columns} />
        <RollupTable label={quarterlyLabel} rows={quarterly} totalCount={quarterlyTotal} columns={columns} />
      </div>
    </article>
  )
}

type RollupTableProps<T extends object> = {
  label: string
  rows: T[]
  totalCount: number
  columns: RollupColumn<T>[]
}

function RollupTable<T extends object>({ label, rows, totalCount, columns }: RollupTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        No {label.toLowerCase()} data yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span>{label}</span>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {rows.length === totalCount ? `Showing ${rows.length}` : `Showing last ${rows.length} of ${totalCount}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs uppercase dark:bg-slate-900/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-400 ${
                    column.format && column.format !== 'plain' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={String(row[columns[0].key])} className="text-slate-700 dark:text-slate-200">
                {columns.map((column) => {
                  const raw = row[column.key]
                  const formatted = formatRollupValue(raw, column.format)
                  const isNumeric = typeof raw === 'number'
                  const alignRight = column.format && column.format !== 'plain'
                  const highlightClass =
                    column.highlight && isNumeric
                      ? raw >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-300'

                  return (
                    <td
                      key={String(column.key)}
                      className={`px-3 py-2 ${alignRight ? 'text-right tabular-nums' : 'text-left'} ${highlightClass}`}
                    >
                      {formatted}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return '—'
  const formatter = Math.abs(value) < 1000 ? preciseCurrencyFormatter : currencyFormatter
  return formatter.format(value)
}

function formatPercentValue(value: number) {
  if (!Number.isFinite(value)) return '—'
  const normalized = Math.abs(value) > 1 ? value / 100 : value
  return `${(normalized * 100).toFixed(1)}%`
}

function formatUnits(value: number) {
  if (!Number.isFinite(value)) return '—'
  return unitFormatter.format(value)
}

function formatWeeks(value: number) {
  if (!Number.isFinite(value)) return '—'
  return weeksFormatter.format(value)
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatRollupValue(value: unknown, format: RollupColumn<object>['format']) {
  if (typeof value === 'number') {
    if (format === 'currency') return formatCurrency(value)
    if (format === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
    return value.toLocaleString('en-US')
  }
  if (typeof value === 'string') {
    return value
  }
  return '—'
}

function limitRows<T>(rows: T[], limit: number) {
  if (rows.length <= limit) return rows
  return rows.slice(-limit)
}
