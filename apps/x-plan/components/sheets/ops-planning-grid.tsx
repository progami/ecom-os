'use client';

import { useEffect, useMemo, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import '@/styles/handsontable-theme.css';
import { toast } from 'sonner';
import { GridLegend } from '@/components/grid-legend';
import { GridSurface } from '@/components/grid-surface';

registerAllModules();

export type OpsInputRow = {
  id: string;
  productId: string;
  orderCode: string;
  productName: string;
  quantity: string;
  pay1Date: string;
  productionWeeks: string;
  sourcePrepWeeks: string;
  oceanWeeks: string;
  finalMileWeeks: string;
  sellingPrice: string;
  manufacturingCost: string;
  freightCost: string;
  tariffRate: string;
  tacosPercent: string;
  fbaFee: string;
  referralRate: string;
  storagePerMonth: string;
  status: string;
  notes: string;
};

interface OpsPlanningGridProps {
  rows: OpsInputRow[];
  activeOrderId?: string | null;
  onSelectOrder?: (orderId: string) => void;
  onRowsChange?: (rows: OpsInputRow[]) => void;
}

const COLUMN_HEADERS = [
  'PO Code',
  'Product',
  'Units',
  'Req. Date',
  'Prod. (wk)',
  'Source (wk)',
  'Ocean (wk)',
  'Final (wk)',
  'Status',
  'Notes',
];

const COLUMN_SETTINGS: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', className: 'cell-editable', width: 150 },
  { data: 'productName', readOnly: true, className: 'cell-readonly', width: 200 },
  {
    data: 'quantity',
    type: 'numeric',
    numericFormat: { pattern: '0,0' },
    className: 'cell-editable text-right',
    width: 110,
  },
  {
    data: 'pay1Date',
    type: 'date',
    dateFormat: 'MMM D YYYY',
    correctFormat: true,
    className: 'cell-editable',
    width: 150,
  },
  {
    data: 'productionWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
  },
  {
    data: 'sourcePrepWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
  },
  {
    data: 'oceanWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
  },
  {
    data: 'finalMileWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
  },
  {
    data: 'status',
    type: 'dropdown',
    source: ['PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED', 'CANCELLED'],
    strict: true,
    allowInvalid: false,
    className: 'cell-editable uppercase',
    width: 130,
  },
  { data: 'notes', className: 'cell-editable', width: 200 },
];

const NUMERIC_PRECISION: Partial<Record<keyof OpsInputRow, number>> = {
  quantity: 0,
  productionWeeks: 2,
  sourcePrepWeeks: 2,
  oceanWeeks: 2,
  finalMileWeeks: 2,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  tariffRate: 4,
  tacosPercent: 4,
  fbaFee: 2,
  referralRate: 4,
  storagePerMonth: 2,
};

const NUMERIC_FIELDS = new Set<keyof OpsInputRow>([
  'quantity',
  'productionWeeks',
  'sourcePrepWeeks',
  'oceanWeeks',
  'finalMileWeeks',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffRate',
  'tacosPercent',
  'fbaFee',
  'referralRate',
  'storagePerMonth',
]);
const DATE_FIELDS = new Set<keyof OpsInputRow>(['pay1Date']);

function normalizeNumeric(value: unknown, fractionDigits = 2) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value ?? '');
  return numeric.toFixed(fractionDigits);
}

export function OpsPlanningGrid({
  rows,
  activeOrderId,
  onSelectOrder,
  onRowsChange,
}: OpsPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null);
  const pendingRef = useRef<Map<string, { id: string; values: Record<string, string> }>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo(() => rows, [rows]);

  const metrics = useMemo(() => {
    const orderCount = data.length;
    let totalUnits = 0;
    for (const row of data) {
      totalUnits += Number(row.quantity ?? 0);
    }
    const formattedUnits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      totalUnits,
    );
    return { orderCount, formattedUnits };
  }, [data]);

  const activeOrderLabel = useMemo(() => {
    if (!activeOrderId) return 'No selection';
    const match = data.find((row) => row.id === activeOrderId);
    if (!match) return 'No selection';
    return `${match.orderCode ?? 'PO'} • ${match.productName}`;
  }, [activeOrderId, data]);

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data);
    }
  }, [data]);

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values());
      if (payload.length === 0) return;
      pendingRef.current.clear();
      try {
        const response = await fetch('/api/v1/x-plan/purchase-orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        });
        if (!response.ok) throw new Error('Failed to update purchase orders');
        toast.success('PO inputs saved');
      } catch (error) {
        console.error(error);
        toast.error('Unable to save purchase order inputs');
      }
    }, 500);
  };

  return (
    <GridSurface>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Step 2
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Lead &amp; Schedule Inputs
          </h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Maintain a single source of truth for purchase orders, lead time assumptions, and
            production status. Update the blue driver cells—derived dates and inventory math will
            ripple through the rest of the workbook.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              {metrics.orderCount} purchase orders
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              {metrics.formattedUnits} units in flight
            </span>
          </div>
        </div>
        <div className="max-w-sm rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300">
          <p className="font-semibold text-slate-700 dark:text-slate-100">Active row</p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {activeOrderLabel}
          </p>
          <p className="mt-2 leading-5">
            Click a row or use arrow keys to focus it—linked cost overrides, payment schedules, and
            the timeline will follow the highlighted purchase order.
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
          columns={COLUMN_SETTINGS}
          colHeaders={COLUMN_HEADERS}
          stretchH="all"
          className="x-plan-hot"
          rowHeaders={false}
          height="auto"
          dropdownMenu
          filters
          cells={(row) => {
            const meta = {} as Handsontable.CellMeta;
            const record = data[row];
            if (record && activeOrderId && record.id === activeOrderId) {
              meta.className = meta.className ? `${meta.className} row-active` : 'row-active';
            }
            return meta;
          }}
          afterSelectionEnd={(row) => {
            if (!onSelectOrder) return;
            const record = data[row];
            if (record) onSelectOrder(record.id);
          }}
          afterChange={(changes, rawSource) => {
            if (!changes || rawSource === 'loadData') return;
            const hot = hotRef.current;
            if (!hot) return;

            for (const change of changes) {
              const [rowIndex, prop, _oldValue, newValue] = change as [
                number,
                keyof OpsInputRow,
                any,
                any,
              ];
              const record = hot.getSourceDataAtRow(rowIndex) as OpsInputRow | null;
              if (!record) continue;

              if (!pendingRef.current.has(record.id)) {
                pendingRef.current.set(record.id, { id: record.id, values: {} });
              }
              const entry = pendingRef.current.get(record.id);
              if (!entry) continue;

              if (NUMERIC_FIELDS.has(prop)) {
                const precision = NUMERIC_PRECISION[prop] ?? 2;
                const normalized = normalizeNumeric(newValue, precision);
                entry.values[prop] = normalized;
                record[prop] = normalized as OpsInputRow[typeof prop];
              } else if (DATE_FIELDS.has(prop)) {
                const value = newValue ? String(newValue) : '';
                entry.values[prop] = value;
                record[prop] = value as OpsInputRow[typeof prop];
              } else {
                const value = newValue == null ? '' : String(newValue);
                entry.values[prop] = value;
                record[prop] = value as OpsInputRow[typeof prop];
              }
            }

            if (onRowsChange) {
              const updated = (hot.getSourceData() as OpsInputRow[]).map((row) => ({ ...row }));
              onRowsChange(updated);
            }

            flush();
          }}
        />
      </div>
    </GridSurface>
  );
}
