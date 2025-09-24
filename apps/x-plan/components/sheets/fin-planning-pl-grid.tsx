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
  units: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
  grossMargin: string;
  amazonFees: string;
  ppcSpend: string;
  fixedCosts: string;
  totalOpex: string;
  netProfit: string;
};

type SummaryRow = {
  periodLabel: string;
  revenue?: string;
  cogs?: string;
  grossProfit?: string;
  amazonFees?: string;
  ppcSpend?: string;
  fixedCosts?: string;
  totalOpex?: string;
  netProfit?: string;
  amazonPayout?: string;
  inventorySpend?: string;
  netCash?: string;
  closingCash?: string;
};

type UpdatePayload = {
  weekNumber: number;
  values: Partial<Record<keyof WeeklyRow, string>>;
};

interface ProfitAndLossGridProps {
  weekly: WeeklyRow[];
  monthlySummary: SummaryRow[];
  quarterlySummary: SummaryRow[];
}

const editableFields: (keyof WeeklyRow)[] = [
  'units',
  'revenue',
  'cogs',
  'amazonFees',
  'ppcSpend',
  'fixedCosts',
];

function normalizeEditable(value: unknown) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value ?? '');
  return numeric.toFixed(2);
}

export function ProfitAndLossGrid({
  weekly,
  monthlySummary,
  quarterlySummary,
}: ProfitAndLossGridProps) {
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
        data: 'units',
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !editableFields.includes('units'),
        className: editableFields.includes('units') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'revenue',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('revenue'),
        className: editableFields.includes('revenue') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'cogs',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('cogs'),
        className: editableFields.includes('cogs') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'grossProfit',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: true,
        className: 'cell-readonly',
      },
      {
        data: 'grossMargin',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        readOnly: true,
        className: 'cell-readonly',
      },
      {
        data: 'amazonFees',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonFees'),
        className: editableFields.includes('amazonFees') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'ppcSpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('ppcSpend'),
        className: editableFields.includes('ppcSpend') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'fixedCosts',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('fixedCosts'),
        className: editableFields.includes('fixedCosts') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'totalOpex',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: true,
        className: 'cell-readonly',
      },
      {
        data: 'netProfit',
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
        const res = await fetch('/api/v1/x-plan/profit-and-loss', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        });
        if (!res.ok) throw new Error('Failed to update P&L');
        toast.success('P&L updated');
      } catch (error) {
        console.error(error);
        toast.error('Unable to save P&L changes');
      }
    }, 600);
  };

  return (
    <div className="space-y-6">
      <GridSurface>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Step 4
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Weekly Profit &amp; Loss
            </h2>
            <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Enter demand, revenue, and spend assumptions. The grey outputs consolidate
              contribution margin, operating expense, and net income so you can pressure test
              scenarios without leaving the sheet.
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
              'Units',
              'Revenue',
              'COGS',
              'Gross Profit',
              'GP%',
              'Amazon Fees',
              'PPC',
              'Fixed Costs',
              'Total OpEx',
              'Net Profit',
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
          <SummaryTable title="Monthly P&L Summary" rows={monthlySummary} />
          <SummaryTable title="Quarterly P&L Summary" rows={quarterlySummary} />
        </div>
      )}
    </div>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  const headers = [
    'Period',
    'Revenue',
    'COGS',
    'Gross Profit',
    'Amazon Fees',
    'PPC',
    'Fixed Costs',
    'Total OpEx',
    'Net Profit',
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
                <td className="px-3 py-2">{formatValue(row.revenue ?? row.amazonPayout)}</td>
                <td className="px-3 py-2">{formatValue(row.cogs ?? row.inventorySpend)}</td>
                <td className="px-3 py-2">{formatValue(row.grossProfit)}</td>
                <td className="px-3 py-2">{formatValue(row.amazonFees)}</td>
                <td className="px-3 py-2">{formatValue(row.ppcSpend)}</td>
                <td className="px-3 py-2">{formatValue(row.fixedCosts)}</td>
                <td className="px-3 py-2">{formatValue(row.totalOpex ?? row.netCash)}</td>
                <td className="px-3 py-2">{formatValue(row.netProfit ?? row.closingCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
