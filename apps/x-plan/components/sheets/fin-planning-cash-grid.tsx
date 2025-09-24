'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import '@/styles/handsontable-theme.css';
import { toast } from 'sonner';
import { GridLegend } from '@/components/grid-legend';
import { GridSurface } from '@/components/grid-surface';

registerAllModules();

type WeeklyRow = {
  weekNumber: string;
  weekDate: string;
  amazonPayout: string;
  inventorySpend: string;
  fixedCosts: string;
  netCash: string;
  cashBalance: string;
};

type SummaryRow = {
  periodLabel: string;
  amazonPayout?: string;
  inventorySpend?: string;
  fixedCosts?: string;
  netCash?: string;
  closingCash?: string;
};

type UpdatePayload = {
  weekNumber: number;
  values: Partial<Record<keyof WeeklyRow, string>>;
};

interface CashFlowGridProps {
  weekly: WeeklyRow[];
  monthlySummary: SummaryRow[];
  quarterlySummary: SummaryRow[];
}

const editableFields: (keyof WeeklyRow)[] = ['amazonPayout', 'inventorySpend', 'fixedCosts'];

function normalizeEditable(value: unknown) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value ?? '');
  return numeric.toFixed(2);
}

export function CashFlowGrid({ weekly, monthlySummary, quarterlySummary }: CashFlowGridProps) {
  const hotRef = useRef<Handsontable | null>(null);
  const pendingRef = useRef<Map<number, UpdatePayload>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  const data = useMemo(() => weekly, [weekly]);

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data);
    }
  }, [data]);

  const columns: Handsontable.ColumnSettings[] = useMemo(
    () => [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly' },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly' },
      {
        data: 'amazonPayout',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonPayout'),
        className: editableFields.includes('amazonPayout') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'inventorySpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('inventorySpend'),
        className: editableFields.includes('inventorySpend') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'fixedCosts',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('fixedCosts'),
        className: editableFields.includes('fixedCosts') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'netCash',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: true,
        className: 'cell-readonly',
      },
      {
        data: 'cashBalance',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: true,
        className: 'cell-readonly',
      },
    ],
    [],
  );

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values());
      if (payload.length === 0) return;
      pendingRef.current.clear();
      try {
        const res = await fetch('/api/v1/x-plan/cash-flow', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        });
        if (!res.ok) throw new Error('Failed to update cash flow');
        toast.success('Cash flow updated');
      } catch (error) {
        console.error(error);
        toast.error('Unable to save cash flow changes');
      }
    }, 600);
  };

  return (
    <div className="space-y-6">
      <GridSurface>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Step 5
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Cash Flow Simulator
            </h2>
            <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Adjust weekly cash drivers and watch net cash plus ending balance recalculate in real
              time. Layer on payouts, inventory receipts, and fixed costs to stress test upcoming
              liquidity.
            </p>
          </div>
          <button
            onClick={() => setShowSummary((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm transition hover:border-purple-400/60 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-purple-400/40"
          >
            {showSummary ? 'Hide rollups' : 'Show rollups'}
          </button>
        </div>

        <GridLegend />

        <div className="x-plan-grid-shell">
          <HotTable
            ref={(instance) => {
              hotRef.current = instance?.hotInstance ?? null;
            }}
            data={data}
            licenseKey="non-commercial-and-evaluation"
            columns={columns}
            colHeaders={[
              'Week',
              'Date',
              'Amazon Payout',
              'Inventory Purchase',
              'Fixed Costs',
              'Net Cash',
              'Cash Balance',
            ]}
            rowHeaders={false}
            stretchH="all"
            className="x-plan-hot"
            height="auto"
            dropdownMenu
            filters
            afterChange={(changes, source) => {
              if (!changes || source === 'loadData') return;
              const hot = hotRef.current;
              if (!hot) return;
              for (const change of changes) {
                const [rowIndex, prop, _oldValue, newValue] = change as [
                  number,
                  keyof WeeklyRow,
                  any,
                  any,
                ];
                if (!editableFields.includes(prop)) continue;
                const record = hot.getSourceDataAtRow(rowIndex) as WeeklyRow | null;
                if (!record) continue;
                const weekNumber = Number(record.weekNumber);
                if (!pendingRef.current.has(weekNumber)) {
                  pendingRef.current.set(weekNumber, { weekNumber, values: {} });
                }
                const entry = pendingRef.current.get(weekNumber);
                if (!entry) continue;
                entry.values[prop] = normalizeEditable(newValue);
              }
              flush();
            }}
          />
        </div>
      </GridSurface>

      {showSummary && (
        <div className="grid gap-4 md:grid-cols-2">
          <CashSummaryTable title="Monthly Cash Flow Summary" rows={monthlySummary} />
          <CashSummaryTable title="Quarterly Cash Flow Summary" rows={quarterlySummary} />
        </div>
      )}
    </div>
  );
}

function CashSummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  const headers = [
    'Period',
    'Amazon Payout',
    'Inventory Purchase',
    'Fixed Costs',
    'Net Cash',
    'Closing Cash',
  ];
  const formatValue = (value?: string) => {
    if (!value) return '';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    return numeric.toFixed(2);
  };
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/90 to-slate-100/80 p-5 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:from-slate-950/80 dark:via-slate-900/70 dark:to-slate-950/60 dark:shadow-[0_30px_50px_-40px_rgba(15,23,42,0.85)]">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/70 text-sm dark:divide-slate-800/80">
          <thead className="bg-slate-50/80 text-xs uppercase backdrop-blur-sm dark:bg-slate-900/60">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-300"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/70 dark:divide-slate-800/70">
            {rows.map((row) => (
              <tr key={row.periodLabel} className="text-slate-700 dark:text-slate-200">
                <td className="px-3 py-2 font-medium">{row.periodLabel}</td>
                <td className="px-3 py-2">{formatValue(row.amazonPayout)}</td>
                <td className="px-3 py-2">{formatValue(row.inventorySpend)}</td>
                <td className="px-3 py-2">{formatValue(row.fixedCosts)}</td>
                <td className="px-3 py-2">{formatValue(row.netCash)}</td>
                <td className="px-3 py-2">{formatValue(row.closingCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
