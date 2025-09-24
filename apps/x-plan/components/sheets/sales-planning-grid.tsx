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

type SalesRow = {
  weekNumber: string;
  weekDate: string;
  [key: string]: string;
};

type ColumnMeta = Record<string, { productId: string; field: string }>;

const metrics = [
  'stockStart',
  'actualSales',
  'forecastSales',
  'finalSales',
  'stockWeeks',
  'stockEnd',
] as const;
const editableMetrics = new Set(['actualSales', 'forecastSales']);

type SalesUpdate = {
  productId: string;
  weekNumber: number;
  values: Record<string, string>;
};

interface SalesPlanningGridProps {
  rows: SalesRow[];
  columnMeta: ColumnMeta;
  nestedHeaders: (string | { label: string; colspan: number })[][];
  columnKeys: string[];
  productOptions: Array<{ id: string; name: string }>;
}

function normalizeEditableValue(value: unknown) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value ?? '');
  return numeric.toFixed(2);
}

export function SalesPlanningGrid({
  rows,
  columnMeta,
  nestedHeaders,
  columnKeys,
  productOptions,
}: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null);
  const pendingRef = useRef<Map<string, SalesUpdate>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusProductId, setFocusProductId] = useState<string>('ALL');

  const data = useMemo(() => rows, [rows]);

  const focusLabel = useMemo(() => {
    if (focusProductId === 'ALL') return 'All SKUs';
    const match = productOptions.find((option) => option.id === focusProductId);
    return match?.name ?? 'All SKUs';
  }, [focusProductId, productOptions]);

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data);
    }
  }, [data]);

  const columns: Handsontable.ColumnSettings[] = useMemo(() => {
    const base: Handsontable.ColumnSettings[] = [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly' },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly' },
    ];
    for (const key of columnKeys) {
      const meta = columnMeta[key];
      if (!meta) {
        base.push({ data: key, readOnly: true, className: 'cell-readonly' });
        continue;
      }
      base.push({
        data: key,
        type: 'numeric',
        numericFormat: editableMetrics.has(meta.field)
          ? { pattern: '0,0.00' }
          : { pattern: '0.00' },
        readOnly: !editableMetrics.has(meta.field),
        className: editableMetrics.has(meta.field) ? 'cell-editable' : 'cell-readonly',
      });
    }
    return base;
  }, [columnMeta, columnKeys]);

  const hiddenColumns = useMemo(() => {
    if (focusProductId === 'ALL') return [];
    const hidden: number[] = [];
    const offset = 2;
    columnKeys.forEach((key, index) => {
      const meta = columnMeta[key];
      if (!meta) return;
      if (meta.productId !== focusProductId) {
        hidden.push(index + offset);
      }
    });
    return hidden;
  }, [columnKeys, columnMeta, focusProductId]);

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values());
      if (payload.length === 0) return;
      pendingRef.current.clear();
      try {
        const response = await fetch('/api/v1/x-plan/sales-weeks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        });
        if (!response.ok) throw new Error('Failed to update sales planning');
        toast.success('Sales planning updated');
      } catch (error) {
        console.error(error);
        toast.error('Unable to save sales planning changes');
      }
    }, 600);
  };

  return (
    <GridSurface>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Step 3
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Sales Planning Horizon
          </h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Plan actuals vs forecast for every SKU-week. Filter to a single product when you want a
            cleaner runway view—the grid still keeps your totals balanced in the background.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              {data.length} calendar weeks
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              {productOptions.length} SKUs
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-100">Focus SKU</span>
            <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
              {focusLabel}
            </span>
          </div>
          <select
            value={focusProductId}
            onChange={(event) => setFocusProductId(event.target.value)}
            className="rounded-xl border border-slate-300/70 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="ALL">Show every SKU</option>
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="text-[0.65rem] leading-5 text-slate-500 dark:text-slate-400">
            Hiding other columns just tucks them out of view—you&apos;re still updating the overall
            demand plan.
          </p>
        </div>
      </div>

      <GridLegend />

      <div className="x-plan-grid-shell">
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null;
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          colHeaders={false}
          columns={columns}
          nestedHeaders={nestedHeaders}
          stretchH="all"
          className="x-plan-hot"
          height="auto"
          rowHeaders={false}
          dropdownMenu
          filters
          hiddenColumns={{ columns: hiddenColumns, indicators: true }}
          afterChange={(changes, source) => {
            if (!changes || source === 'loadData') return;
            const hot = hotRef.current;
            if (!hot) return;
            for (const change of changes) {
              const [rowIndex, prop, _oldValue, newValue] = change as [number, string, any, any];
              const meta = columnMeta[prop];
              if (!meta || !editableMetrics.has(meta.field)) continue;
              const record = hot.getSourceDataAtRow(rowIndex) as SalesRow | null;
              if (!record) continue;
              const key = `${meta.productId}-${record.weekNumber}`;
              if (!pendingRef.current.has(key)) {
                pendingRef.current.set(key, {
                  productId: meta.productId,
                  weekNumber: Number(record.weekNumber),
                  values: {},
                });
              }
              const entry = pendingRef.current.get(key);
              if (!entry) continue;
              entry.values[meta.field] = normalizeEditableValue(newValue);
            }
            flush();
          }}
        />
      </div>
    </GridSurface>
  );
}
