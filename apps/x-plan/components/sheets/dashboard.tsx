interface DashboardData {
  revenueYTD: string
  netProfitYTD: string
  cashBalance: string
  netMargin: string
  pipeline: Array<{ status: string; quantity: number }>
  inventory: Array<{ productName: string; stockEnd: number; stockWeeks: string }>
}

export function DashboardSheet({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Revenue YTD" value={`$${formatNumber(data.revenueYTD)}`} />
        <MetricCard title="Net Profit YTD" value={`$${formatNumber(data.netProfitYTD)}`} />
        <MetricCard title="Cash Balance" value={`$${formatNumber(data.cashBalance)}`} />
        <MetricCard title="Net Margin" value={`${formatNumber(data.netMargin)}%`} trend={Number(data.netMargin) >= 0 ? 'up' : 'down'} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pipeline by Status
          </h2>
          <dl className="space-y-2">
            {data.pipeline.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                <dt className="font-medium text-slate-700 dark:text-slate-200">{formatStatus(item.status)}</dt>
                <dd className="tabular-nums text-slate-600 dark:text-slate-300">{item.quantity.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Inventory Snapshot
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-xs uppercase dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-400">Product</th>
                  <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Units</th>
                  <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Weeks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.inventory.map((item) => (
                  <tr key={item.productName} className="text-slate-700 dark:text-slate-200">
                    <td className="px-3 py-2 font-medium">{item.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.stockEnd.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.stockWeeks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ title, value, trend }: { title: string; value: string; trend?: 'up' | 'down' }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      {trend && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {trend === 'up' ? 'Healthy margin' : 'Negative margin'}
        </p>
      )}
    </article>
  )
}

function formatNumber(value: string) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return value
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

