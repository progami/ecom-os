'use client';

import { addWeeks } from 'date-fns';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { toast } from 'sonner';
import { SelectionStatsBar } from '@/components/ui/selection-stats-bar';
import {
  formatNumericInput,
  numericValidator,
  parseNumericInput,
} from '@/components/sheets/validators';
import { useMutationQueue } from '@/hooks/useMutationQueue';
import { useHandsontableThemeName } from '@/hooks/useHandsontableThemeName';
import { usePersistentHandsontableScroll } from '@/hooks/usePersistentHandsontableScroll';
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar';
import { usePersistentState } from '@/hooks/usePersistentState';
import { withAppBasePath } from '@/lib/base-path';
import {
  finishEditingSafely,
  getSelectionStats,
  type HandsontableSelectionStats,
} from '@/lib/handsontable';
import { formatDateDisplay } from '@/lib/utils/dates';

registerAllModules();

const PLANNING_ANCHOR_WEEK = 1;
const PLANNING_ANCHOR_DATE = new Date('2025-01-05T00:00:00.000Z');

function formatWeekDateFallback(weekNumber: number): string {
  return formatDateDisplay(addWeeks(PLANNING_ANCHOR_DATE, weekNumber - PLANNING_ANCHOR_WEEK));
}

function getHandsontableScrollHolder(hot: Handsontable | null): HTMLElement | null {
  if (!hot?.rootElement) return null;
  return (
    (hot.rootElement.querySelector('.ht_master .wtHolder') as HTMLElement | null) ??
    (hot.rootElement.querySelector('.wtHolder') as HTMLElement | null)
  );
}

function getHandsontableScroll(hot: Handsontable | null): { top: number; left: number } | null {
  const holder = getHandsontableScrollHolder(hot);
  if (!holder) return null;
  return { top: holder.scrollTop, left: holder.scrollLeft };
}

function restoreHandsontableScroll(
  hot: Handsontable | null,
  scroll: { top: number; left: number },
): boolean {
  const holder = getHandsontableScrollHolder(hot);
  if (!holder) return false;
  holder.scrollTop = scroll.top;
  holder.scrollLeft = scroll.left;
  return true;
}

type SalesRow = {
  weekNumber: string;
  weekLabel: string;
  weekDate: string;
  arrivalNote?: string;
  [key: string]: string | undefined;
};

type ColumnMeta = Record<string, { productId: string; field: string }>;
type NestedHeaderCell = string | { label: string; colspan?: number; rowspan?: number };
type HandsontableNestedHeaders = NonNullable<Handsontable.GridSettings['nestedHeaders']>;
const editableMetrics = new Set(['actualSales', 'forecastSales']);
const BASE_SALES_METRICS = [
  'stockStart',
  'actualSales',
  'forecastSales',
  'finalSales',
  'finalSalesError',
] as const;
const STOCK_METRIC_OPTIONS = [
  { id: 'stockWeeks', label: 'Stockout (Weeks)' },
  { id: 'stockEnd', label: 'Stock Qty' },
] as const;
type StockMetricId = (typeof STOCK_METRIC_OPTIONS)[number]['id'];

const WEEK_COLUMN_WIDTH = 92;
const DATE_COLUMN_WIDTH = 136;
const METRIC_MIN_WIDTH = 132;

function isEditableMetric(field: string | undefined) {
  return Boolean(field && editableMetrics.has(field));
}

type SalesUpdate = {
  productId: string;
  weekNumber: number;
  values: Record<string, string>;
};

type SalesPlanningFocusContextValue = {
  focusProductId: string;
  setFocusProductId: (value: string) => void;
};

const SalesPlanningFocusContext = createContext<SalesPlanningFocusContextValue | null>(null);

export function useSalesPlanningFocus() {
  return useContext(SalesPlanningFocusContext);
}

export function SalesPlanningFocusProvider({ children }: { children: ReactNode }) {
  const [focusProductId, setFocusProductId] = usePersistentState<string>(
    'xplan:sales-grid:focus-product',
    'ALL',
  );
  const value = useMemo(
    () => ({ focusProductId, setFocusProductId }),
    [focusProductId, setFocusProductId],
  );
  return (
    <SalesPlanningFocusContext.Provider value={value}>
      {children}
    </SalesPlanningFocusContext.Provider>
  );
}

export function SalesPlanningFocusControl({
  productOptions,
}: {
  productOptions: Array<{ id: string; name: string }>;
}) {
  const context = useContext(SalesPlanningFocusContext);
  if (!context) return null;
  const { focusProductId, setFocusProductId } = context;

  return (
    <label className={`${SHEET_TOOLBAR_GROUP} cursor-pointer`}>
      <span className={SHEET_TOOLBAR_LABEL}>Focus SKU</span>
      <select
        value={focusProductId}
        onChange={(event) => setFocusProductId(event.target.value)}
        className={SHEET_TOOLBAR_SELECT}
      >
        <option value="ALL">Show all</option>
        {productOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

type BatchAllocationMeta = {
  orderCode: string;
  batchCode?: string | null;
  quantity: number;
  sellingPrice: number;
  landedUnitCost: number;
};

type LeadTimeByProduct = Record<
  string,
  {
    productionWeeks: number;
    sourceWeeks: number;
    oceanWeeks: number;
    finalWeeks: number;
    totalWeeks: number;
  }
>;

type ReorderCueMeta = {
  startWeekNumber: number;
  startWeekLabel: string | null;
  startYear: number | null;
  startDate: string;
  breachWeekNumber: number;
  breachWeekLabel: string | null;
  breachYear: number | null;
  breachDate: string;
  leadTimeWeeks: number;
};

interface SalesPlanningGridProps {
  strategyId: string;
  rows: SalesRow[];
  hiddenRowIndices?: number[];
  columnMeta: ColumnMeta;
  nestedHeaders: NestedHeaderCell[][];
  columnKeys: string[];
  productOptions: Array<{ id: string; name: string }>;
  stockWarningWeeks: number;
  leadTimeByProduct: LeadTimeByProduct;
  batchAllocations: Map<string, BatchAllocationMeta[]>;
  reorderCueByProduct: Map<string, ReorderCueMeta>;
}

export function SalesPlanningGrid({
  strategyId,
  rows,
  hiddenRowIndices,
  columnMeta,
  nestedHeaders,
  columnKeys,
  productOptions,
  stockWarningWeeks,
  leadTimeByProduct,
  batchAllocations,
  reorderCueByProduct,
}: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null);
  const focusContext = useContext(SalesPlanningFocusContext);
  const scrollRestoreRequestRef = useRef(0);
  const [activeStockMetric, setActiveStockMetric] = usePersistentState<StockMetricId>(
    'xplan:sales-grid:metric',
    'stockWeeks',
  );
  const [showFinalError, setShowFinalError] = usePersistentState<boolean>(
    'xplan:sales-grid:show-final-error',
    false,
  );
  const [selectionStats, setSelectionStats] = useState<HandsontableSelectionStats | null>(null);
  const reorderCueByProductRef = useRef<Map<string, ReorderCueMeta>>(new Map());
  const themeName = useHandsontableThemeName();
  const focusProductId = focusContext?.focusProductId ?? 'ALL';
  const warningThreshold = Number.isFinite(stockWarningWeeks)
    ? stockWarningWeeks
    : Number.POSITIVE_INFINITY;

  usePersistentHandsontableScroll(hotRef, `sales-planning:${strategyId}`);

  const updateSelectionStats = useCallback(() => {
    const hot = hotRef.current;
    if (!hot) return;
    setSelectionStats(getSelectionStats(hot));
  }, []);

  const preserveScrollPosition = useCallback((action: () => void) => {
    const scroll = getHandsontableScroll(hotRef.current);
    action();
    if (!scroll) return;

    scrollRestoreRequestRef.current += 1;
    const requestId = scrollRestoreRequestRef.current;

    let userInteracted = false;

    const markUserIntent = () => {
      userInteracted = true;
    };

    const markUserIntentWithinHot = (event: Event) => {
      const root = hotRef.current?.rootElement ?? null;
      if (!root) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!root.contains(target)) return;
      markUserIntent();
    };

    const holder = getHandsontableScrollHolder(hotRef.current);

    // Use capture on window to ensure we detect wheel/touch events even if Handsontable
    // stops propagation within the table. This prevents scroll restore from fighting user scroll.
    window.addEventListener('wheel', markUserIntentWithinHot, { passive: true, capture: true });
    window.addEventListener('touchmove', markUserIntentWithinHot, { passive: true, capture: true });
    window.addEventListener('pointerdown', markUserIntentWithinHot, { passive: true, capture: true });

    holder?.addEventListener('wheel', markUserIntent, { passive: true, capture: true });
    holder?.addEventListener('scroll', markUserIntent, { passive: true });

    const cleanup = () => {
      window.removeEventListener('wheel', markUserIntentWithinHot, { capture: true });
      window.removeEventListener('touchmove', markUserIntentWithinHot, { capture: true });
      window.removeEventListener('pointerdown', markUserIntentWithinHot, { capture: true });

      holder?.removeEventListener('wheel', markUserIntent, { capture: true });
      holder?.removeEventListener('scroll', markUserIntent);
    };

    const threshold = 4;

    const attemptRestore = (attempt = 0) => {
      if (requestId !== scrollRestoreRequestRef.current) {
        cleanup();
        return;
      }
      if (userInteracted) {
        cleanup();
        return;
      }

      const current = getHandsontableScroll(hotRef.current);
      if (!current) {
        if (attempt < 24) {
          requestAnimationFrame(() => attemptRestore(attempt + 1));
        } else {
          cleanup();
        }
        return;
      }

      const deltaTop = Math.abs(current.top - scroll.top);
      const deltaLeft = Math.abs(current.left - scroll.left);
      const shouldRestoreTop =
        current.top <= threshold && scroll.top > threshold && deltaTop > threshold;
      const shouldRestoreLeft =
        current.left <= threshold && scroll.left > threshold && deltaLeft > threshold;
      if (shouldRestoreTop || shouldRestoreLeft) {
        restoreHandsontableScroll(hotRef.current, scroll);
      }
      cleanup();
    };

    requestAnimationFrame(() => requestAnimationFrame(() => attemptRestore()));
  }, []);

  useEffect(() => {
    reorderCueByProductRef.current = new Map(reorderCueByProduct);
  }, [reorderCueByProduct]);

  const data = useMemo(() => rows, [rows]);
  const weekDateByNumber = useMemo(() => {
    const map = new Map<number, string>();
    data.forEach((row) => {
      const week = Number(row.weekNumber);
      if (!Number.isFinite(week)) return;
      map.set(week, row.weekDate ?? '');
    });
    return map;
  }, [data]);
  const weekLabelByNumber = useMemo(() => {
    const map = new Map<number, string>();
    data.forEach((row) => {
      const week = Number(row.weekNumber);
      if (!Number.isFinite(week)) return;
      map.set(week, row.weekLabel ?? '');
    });
    return map;
  }, [data]);
  const hasInboundByWeek = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((row) => {
      const week = Number(row.weekNumber);
      if (!Number.isFinite(week)) return;
      if ((row.arrivalDetail ?? '').trim()) {
        set.add(week);
      }
    });
    return set;
  }, [rows]);

  const stockWeeksKeyByProduct = useMemo(() => {
    const map = new Map<string, string>();
    columnKeys.forEach((columnKey) => {
      const meta = columnMeta[columnKey];
      if (meta?.field === 'stockWeeks') {
        map.set(meta.productId, columnKey);
      }
    });
    return map;
  }, [columnKeys, columnMeta]);

  const formatBatchComment = useCallback((allocations: BatchAllocationMeta[]): string => {
    if (!allocations || allocations.length === 0) return '';
    const lines = allocations.map((alloc) => {
      const batchId = alloc.batchCode || alloc.orderCode;
      const qty = Number(alloc.quantity).toFixed(0);
      const price = Number(alloc.sellingPrice).toFixed(2);
      const cost = Number(alloc.landedUnitCost).toFixed(3);
      return `${batchId}: ${qty} units @ $${price} (cost: $${cost})`;
    });
    return `FIFO Batch Allocation:\n${lines.join('\n')}`;
  }, []);

  const visibleMetrics = useMemo(() => {
    const metrics = new Set<string>(['stockStart', 'actualSales', 'forecastSales']);
    metrics.add(showFinalError ? 'finalSalesError' : 'finalSales');
    metrics.add(activeStockMetric);
    return metrics;
  }, [activeStockMetric, showFinalError]);

  useEffect(() => {
    if (!focusContext) return;
    if (
      focusContext.focusProductId !== 'ALL' &&
      !productOptions.some((option) => option.id === focusContext.focusProductId)
    ) {
      focusContext.setFocusProductId('ALL');
    }
  }, [focusContext, productOptions]);

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data);
    }
  }, [data]);

  useEffect(() => {
    hotRef.current?.render();
  }, [activeStockMetric, showFinalError]);

  const widthByColumn = useMemo(() => {
    const measure = (values: string[], { min = 80, max = 200, padding = 18 } = {}) => {
      const normalized = values.map((value) =>
        (value ?? '').toString().replace(/\s+/g, ' ').trim(),
      );
      const longest = normalized.reduce((maxLen, value) => Math.max(maxLen, value.length), 0);
      return Math.max(min, Math.min(max, padding + longest * 8));
    };

    const map: Record<string, number> = {};
    map.weekLabel = WEEK_COLUMN_WIDTH;
    map.weekDate = DATE_COLUMN_WIDTH;
    map.arrivalDetail = measure(
      rows.map((row) => row.arrivalDetail ?? ''),
      { min: 110, max: 220, padding: 14 },
    );

    columnKeys.forEach((key) => {
      const values = rows.map((row) => row[key] ?? '');
      const meta = columnMeta[key];
      let bounds: { min: number; max: number; padding: number };
      switch (meta?.field) {
        case 'actualSales':
        case 'forecastSales':
          bounds = { min: 150, max: 260, padding: 32 };
          break;
        case 'finalSalesError':
          bounds = { min: 120, max: 200, padding: 26 };
          break;
        case 'stockStart':
          bounds = { min: 140, max: 240, padding: 36 };
          break;
        default:
          bounds = { min: 130, max: 220, padding: 24 };
          break;
      }
      map[key] = measure(values, bounds);
    });

    return map;
  }, [columnKeys, columnMeta, rows]);

  const columns: Handsontable.ColumnSettings[] = useMemo(() => {
    const base: Handsontable.ColumnSettings[] = [
      {
        data: 'weekLabel',
        readOnly: true,
        className: 'cell-readonly cell-common',
        width: WEEK_COLUMN_WIDTH,
      },
      {
        data: 'weekDate',
        readOnly: true,
        className: 'cell-readonly cell-common',
        width: DATE_COLUMN_WIDTH,
      },
      {
        data: 'arrivalDetail',
        readOnly: true,
        className: 'cell-readonly cell-note cell-common',
        editor: false,
        width: widthByColumn.arrivalDetail,
        wordWrap: true,
      },
    ];
    for (const key of columnKeys) {
      const meta = columnMeta[key];
      if (!meta) {
        base.push({
          data: key,
          readOnly: true,
          className: 'cell-readonly',
          editor: false,
          width: widthByColumn[key] ?? 100,
        });
        continue;
      }
      const editable = isEditableMetric(meta.field);
      const isFinalError = meta.field === 'finalSalesError';
      const measured = widthByColumn[key] ?? (isFinalError ? 96 : editable ? 88 : 86);
      const columnWidth = isFinalError ? measured : Math.max(METRIC_MIN_WIDTH, measured);
      base.push({
        data: key,
        type: isFinalError ? 'text' : 'numeric',
        numericFormat: !isFinalError
          ? editable
            ? { pattern: '0,0.00' }
            : { pattern: '0.00' }
          : undefined,
        readOnly: !editable,
        editor: editable ? Handsontable.editors.NumericEditor : false,
        className: isFinalError
          ? 'cell-readonly cell-note'
          : editable
            ? 'cell-editable'
            : 'cell-readonly',
        validator: editable ? numericValidator : undefined,
        allowInvalid: false,
        width: columnWidth,
        wordWrap: isFinalError,
      });
    }
    return base;
  }, [columnMeta, columnKeys, widthByColumn]);

  const columnWidths = useMemo<number[]>(
    () =>
      columns.map((column) => (typeof column.width === 'number' ? column.width : METRIC_MIN_WIDTH)),
    [columns],
  );

  const clampStretchWidth = useCallback((width: number, column: number) => {
    if (column === 0) return WEEK_COLUMN_WIDTH;
    if (column === 1) return DATE_COLUMN_WIDTH;
    return width;
  }, []);

  const hiddenColumns = useMemo(() => {
    const hidden: number[] = [];
    const offset = 3;
    columnKeys.forEach((key, index) => {
      const meta = columnMeta[key];
      if (!meta) return;
      const columnIndex = index + offset;
      if (focusProductId !== 'ALL' && meta.productId !== focusProductId) {
        hidden.push(columnIndex);
        return;
      }
      if (!visibleMetrics.has(meta.field)) {
        hidden.push(columnIndex);
      }
    });
    return hidden;
  }, [columnKeys, columnMeta, focusProductId, visibleMetrics]);

  const recomputeDerivedForProduct = useCallback(
    (productId: string, startRowIndex: number | null = null) => {
      const hot = hotRef.current;
      if (!hot) return;

      const sourceData = hot.getSourceData() as SalesRow[];
      if (!sourceData || sourceData.length === 0) return;

      const extractYear = (label: string): number | null => {
        const match = label.match(/(\d{4})\s*$/);
        if (!match) return null;
        const year = Number(match[1]);
        return Number.isFinite(year) ? year : null;
      };

      const keysByField = new Map<string, string>();
      for (const key of columnKeys) {
        const meta = columnMeta[key];
        if (!meta || meta.productId !== productId) continue;
        keysByField.set(meta.field, key);
      }

      const stockStartKey = keysByField.get('stockStart');
      const actualSalesKey = keysByField.get('actualSales');
      const forecastSalesKey = keysByField.get('forecastSales');
      const finalSalesKey = keysByField.get('finalSales');
      const finalSalesErrorKey = keysByField.get('finalSalesError');
      const stockWeeksKey = keysByField.get('stockWeeks');
      const stockEndKey = keysByField.get('stockEnd');

      if (
        !stockStartKey ||
        !actualSalesKey ||
        !forecastSalesKey ||
        !finalSalesKey ||
        !finalSalesErrorKey ||
        !stockWeeksKey ||
        !stockEndKey
      ) {
        return;
      }

      const n = sourceData.length;
      const previousStockStart: number[] = new Array(n);
      const previousStockEnd: number[] = new Array(n);
      const actual: Array<number | null> = new Array(n);
      const forecast: Array<number | null> = new Array(n);

      for (let i = 0; i < n; i += 1) {
        const row = sourceData[i];
        previousStockStart[i] = parseNumericInput(row?.[stockStartKey]) ?? 0;
        previousStockEnd[i] = parseNumericInput(row?.[stockEndKey]) ?? 0;
        actual[i] = parseNumericInput(row?.[actualSalesKey]);
        forecast[i] = parseNumericInput(row?.[forecastSalesKey]);
      }

      const inboundDelta: number[] = new Array(n).fill(0);
      for (let i = 1; i < n; i += 1) {
        inboundDelta[i] = previousStockStart[i] - previousStockEnd[i - 1];
      }

      const nextStockStart: number[] = new Array(n);
      const nextFinalSales: number[] = new Array(n);
      const nextStockEnd: number[] = new Array(n);
      const nextError: Array<number | null> = new Array(n);

      nextStockStart[0] = previousStockStart[0];

      for (let i = 0; i < n; i += 1) {
        const demand = actual[i] ?? forecast[i] ?? 0;
        nextFinalSales[i] = Math.max(0, demand);
        nextStockEnd[i] = nextStockStart[i] - nextFinalSales[i];

        if (i + 1 < n) {
          nextStockStart[i + 1] = nextStockEnd[i] + inboundDelta[i + 1];
        }

        if (actual[i] != null && forecast[i] != null && forecast[i] !== 0) {
          nextError[i] = (actual[i]! - forecast[i]!) / Math.abs(forecast[i]!);
        } else {
          nextError[i] = null;
        }
      }

      const nextStockWeeks: number[] = new Array(n);
      const depletionIndexByRow: Array<number | null> = new Array(n).fill(null);
      let nextDepletionIndex: number | null = null;

      for (let i = n - 1; i >= 0; i -= 1) {
        if (nextStockEnd[i] <= 0) {
          nextDepletionIndex = i;
        }
        depletionIndexByRow[i] = nextDepletionIndex;
      }

      const fractionAtDepletion: number[] = new Array(n).fill(0);
      for (let i = 0; i < n; i += 1) {
        if (nextStockEnd[i] > 0) continue;
        const depletionSales = nextFinalSales[i];
        const depletionStart = nextStockStart[i];
        fractionAtDepletion[i] = depletionSales > 0 ? depletionStart / depletionSales : 0;
      }

      for (let i = 0; i < n; i += 1) {
        const depletionIndex = depletionIndexByRow[i];
        if (depletionIndex == null) {
          nextStockWeeks[i] = Number.POSITIVE_INFINITY;
          continue;
        }
        nextStockWeeks[i] = depletionIndex - i + fractionAtDepletion[depletionIndex];
      }

      if (Number.isFinite(warningThreshold) && warningThreshold > 0) {
        const leadProfile = leadTimeByProduct[productId];
        const leadTimeWeeks = leadProfile
          ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks)))
          : 0;
        if (leadTimeWeeks > 0) {
          let hasBeenAbove = false;
          let breachIndex: number | null = null;
          for (let i = 0; i < n; i += 1) {
            const weeksValue = nextStockWeeks[i];
            if (!Number.isFinite(weeksValue)) {
              hasBeenAbove = true;
              continue;
            }
            const isBelow = weeksValue <= warningThreshold;
            if (isBelow && hasBeenAbove) {
              breachIndex = i;
              break;
            }
            if (!isBelow) {
              hasBeenAbove = true;
            }
          }

          if (breachIndex != null) {
            const breachWeekNumber = Number(sourceData[breachIndex]?.weekNumber);
            if (!Number.isFinite(breachWeekNumber)) {
              reorderCueByProductRef.current.delete(productId);
            } else {
              const startWeekNumber = breachWeekNumber - leadTimeWeeks;
              const breachWeekLabel = sourceData[breachIndex]?.weekLabel ?? null;
              const startWeekLabel = weekLabelByNumber.get(startWeekNumber) || null;
              const startDate =
                weekDateByNumber.get(startWeekNumber) || formatWeekDateFallback(startWeekNumber);
              const breachDate =
                sourceData[breachIndex]?.weekDate ||
                weekDateByNumber.get(breachWeekNumber) ||
                formatWeekDateFallback(breachWeekNumber);

              reorderCueByProductRef.current.set(productId, {
                startWeekNumber,
                startWeekLabel,
                startYear: extractYear(startDate),
                startDate,
                breachWeekNumber,
                breachWeekLabel,
                breachYear: extractYear(breachDate),
                breachDate,
                leadTimeWeeks,
              });
            }
          } else {
            reorderCueByProductRef.current.delete(productId);
          }
        } else {
          reorderCueByProductRef.current.delete(productId);
        }
      }

      const changes: Array<[number, string, string]> = [];
      for (let i = 0; i < n; i += 1) {
        const row = sourceData[i];

        const stockStartValue = Number.isFinite(nextStockStart[i])
          ? nextStockStart[i].toFixed(2)
          : '';
        const finalSalesValue = Number.isFinite(nextFinalSales[i])
          ? nextFinalSales[i].toFixed(2)
          : '';
        const stockEndValue = Number.isFinite(nextStockEnd[i]) ? nextStockEnd[i].toFixed(2) : '';
        const stockWeeksValue = Number.isFinite(nextStockWeeks[i])
          ? nextStockWeeks[i].toFixed(2)
          : '∞';
        const errorValue = nextError[i] == null ? '' : `${(nextError[i]! * 100).toFixed(1)}%`;

        if (row?.[stockStartKey] !== stockStartValue) {
          changes.push([i, stockStartKey, stockStartValue]);
        }
        if (row?.[finalSalesKey] !== finalSalesValue) {
          changes.push([i, finalSalesKey, finalSalesValue]);
        }
        if (row?.[stockEndKey] !== stockEndValue) {
          changes.push([i, stockEndKey, stockEndValue]);
        }
        if (row?.[stockWeeksKey] !== stockWeeksValue) {
          changes.push([i, stockWeeksKey, stockWeeksValue]);
        }
        if (row?.[finalSalesErrorKey] !== errorValue) {
          changes.push([i, finalSalesErrorKey, errorValue]);
        }
      }

      if (changes.length > 0) {
        const startIndex = Math.max(0, Math.min(n - 1, startRowIndex ?? 0));
        const slicedChanges =
          startIndex === 0 ? changes : changes.filter(([rowIndex]) => rowIndex >= startIndex);

        if (slicedChanges.length === 0) {
          hot.render();
          return;
        }

        hot.batchRender(() => {
          hot.setDataAtRowProp(slicedChanges, 'derived-update');
        });
        return;
      }
    },
    [
      columnKeys,
      columnMeta,
      leadTimeByProduct,
      warningThreshold,
      weekDateByNumber,
      weekLabelByNumber,
    ],
  );

  const handleColHeader = useCallback(
    (col: number, TH: HTMLTableCellElement, headerLevel: number) => {
      const offset = 3;

      // Apply consistent font sizing for second header row to match P&L/Cash Flow
      if (headerLevel === 1) {
        TH.style.fontSize = '11px';
        TH.style.fontWeight = '700';
        TH.style.letterSpacing = '0.1em';
        TH.style.textTransform = 'uppercase';
      }

      // Handle SKU header row (headerLevel 0) with navigation arrows
      if (headerLevel === 0 && col >= offset) {
        const key = columnKeys[col - offset];
        const meta = columnMeta[key];
        if (!meta) return;

        // Find the current product index and check if we need arrows
        const currentProductId = meta.productId;
        const currentProductIndex = productOptions.findIndex((p) => p.id === currentProductId);
        if (currentProductIndex === -1) return;

        // Only add arrows if there are multiple products
        if (productOptions.length <= 1) return;

        const hasPrev = currentProductIndex > 0;
        const hasNext = currentProductIndex < productOptions.length - 1;
        const showAllArrow = currentProductIndex === 0;

        // Check if this is the first column of this product's section
        const isFirstColumnOfProduct =
          col === offset ||
          columnMeta[columnKeys[col - offset - 1]]?.productId !== currentProductId;
        if (!isFirstColumnOfProduct) return;

        Handsontable.dom.empty(TH);
        const container = document.createElement('div');
        container.className = 'x-plan-sku-header-nav';

        // Previous arrow / Show All button
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        if (showAllArrow) {
          prevBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-all';
          prevBtn.innerHTML = '⊞';
          prevBtn.title = 'Show All SKUs';
        } else {
          prevBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-prev';
          prevBtn.innerHTML = '◀';
          prevBtn.title = hasPrev
            ? `Previous SKU: ${productOptions[currentProductIndex - 1].name}`
            : '';
        }
        prevBtn.style.visibility = hasPrev || showAllArrow ? 'visible' : 'hidden';
        prevBtn.disabled = !(hasPrev || showAllArrow);
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          preserveScrollPosition(() => {
            if (showAllArrow) {
              focusContext?.setFocusProductId('ALL');
            } else if (hasPrev) {
              focusContext?.setFocusProductId(productOptions[currentProductIndex - 1].id);
            }
          });
        });
        prevBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        });
        container.appendChild(prevBtn);

        // SKU name
        const label = document.createElement('span');
        label.className = 'x-plan-sku-header-label';
        label.textContent = productOptions[currentProductIndex].name;
        container.appendChild(label);

        // Next arrow
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-next';
        nextBtn.innerHTML = '▶';
        nextBtn.style.visibility = hasNext ? 'visible' : 'hidden';
        nextBtn.title = hasNext ? `Next SKU: ${productOptions[currentProductIndex + 1].name}` : '';
        nextBtn.disabled = !hasNext;
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          preserveScrollPosition(() => {
            if (hasNext) {
              focusContext?.setFocusProductId(productOptions[currentProductIndex + 1].id);
            }
          });
        });
        nextBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        });
        container.appendChild(nextBtn);

        TH.appendChild(container);
        return;
      }

      // Handle metric header row (headerLevel 1)
      if (headerLevel !== 1 || col < offset) return;
      const key = columnKeys[col - offset];
      const meta = columnMeta[key];
      if (!meta) return;

      const renderToggle = (label: string, handler: () => void, title = label) => {
        Handsontable.dom.empty(TH);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'x-plan-header-toggle';
        button.textContent = label;
        button.title = title;

        let pointerTriggered = false;

        const trigger = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
          const hot = hotRef.current;
          if (hot) finishEditingSafely(hot);
          handler();
        };

        const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
        if (supportsPointer) {
          button.addEventListener(
            'pointerdown',
            (event) => {
              pointerTriggered = true;
              trigger(event);
            },
            { capture: true },
          );
        } else {
          button.addEventListener(
            'mousedown',
            (event) => {
              pointerTriggered = true;
              trigger(event);
            },
            { capture: true },
          );
        }

        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (pointerTriggered) {
            pointerTriggered = false;
            return;
          }
          trigger(event);
        });
        TH.appendChild(button);
      };

      if (meta.field === activeStockMetric) {
        const stockLabel = activeStockMetric === 'stockWeeks' ? 'Stockout' : 'Stock Qty';
        const stockTitle = activeStockMetric === 'stockWeeks' ? 'Stockout (Weeks)' : 'Stock Qty';
        renderToggle(stockLabel, () => {
          preserveScrollPosition(() => {
            setActiveStockMetric((prev) => (prev === 'stockWeeks' ? 'stockEnd' : 'stockWeeks'));
          });
        }, stockTitle);
        return;
      }

      const activeFinalField = showFinalError ? 'finalSalesError' : 'finalSales';
      if (meta.field === activeFinalField) {
        renderToggle(showFinalError ? '% Error' : 'Final Sales', () => {
          preserveScrollPosition(() => {
            setShowFinalError((prev) => !prev);
          });
        });
      }
    },
    [
      activeStockMetric,
      columnKeys,
      columnMeta,
      preserveScrollPosition,
      setActiveStockMetric,
      setShowFinalError,
      showFinalError,
      productOptions,
      focusContext,
    ],
  );

  const handleFlush = useCallback(
    async (payload: SalesUpdate[]) => {
      if (payload.length === 0) return;
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/sales-weeks'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategyId, updates: payload }),
        });
        if (!response.ok) throw new Error('Failed to update sales planning');
        toast.success('Sales planning updated');
      } catch (error) {
        console.error(error);
        toast.error('Unable to save sales planning changes');
      }
    },
    [strategyId],
  );

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<string, SalesUpdate>({
    debounceMs: 600,
    onFlush: handleFlush,
  });

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors handled inside handleFlush
      });
    };
  }, [flushNow]);

  return (
    <div className="p-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null;
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          themeName={themeName}
          width="100%"
          colHeaders={false}
          columns={columns}
          nestedHeaders={nestedHeaders as unknown as HandsontableNestedHeaders}
          afterGetColHeader={handleColHeader}
          stretchH="all"
          className="x-plan-hot x-plan-hot-sales h-full"
          height="100%"
          rowHeaders={false}
          undo
          comments={true}
          hiddenColumns={{ columns: hiddenColumns, indicators: true }}
          hiddenRows={
            hiddenRowIndices && hiddenRowIndices.length > 0
              ? { rows: hiddenRowIndices, indicators: false }
              : undefined
          }
          autoColumnSize={false}
          colWidths={columnWidths}
          beforeStretchingColumnWidth={clampStretchWidth}
          cells={(row, col) => {
            const cell: Handsontable.CellMeta = {};
            const offset = 3;
            const weekNumber = Number(data[row]?.weekNumber);
            const hasInbound = Number.isFinite(weekNumber) && hasInboundByWeek.has(weekNumber);

            if (col < offset) {
              if (hasInbound) {
                cell.className = cell.className
                  ? `${cell.className} row-inbound-sales`
                  : 'row-inbound-sales';
              }
              if (col === 2) {
                const note = data[row]?.arrivalNote;
                if (note && note.trim().length > 0) {
                  cell.comment = { value: note };
                }
              }
              return cell;
            }

            const columnKey = columnKeys[col - offset];
            const meta = columnMeta[columnKey];
            const editable = isEditableMetric(meta?.field);
            cell.readOnly = !editable;
            cell.className = editable ? 'cell-editable' : 'cell-readonly';

            if (meta?.productId) {
              const productId = meta.productId;
              const field = meta.field;
              const reorderInfo = reorderCueByProductRef.current.get(productId);
              const isReorderWeek =
                reorderInfo != null && reorderInfo.startWeekNumber === weekNumber;

              if (isReorderWeek && visibleMetrics.has(field)) {
                cell.className = `${cell.className} cell-reorder-band cell-reorder-suggest`;
              }

              const isStockColumn = field === activeStockMetric;
              const weeksKey =
                isStockColumn || field === 'stockWeeks'
                  ? stockWeeksKeyByProduct.get(productId)
                  : undefined;

              if (weeksKey) {
                const rawWeeks = data[row]?.[weeksKey];

                if (field === 'stockWeeks' && rawWeeks === '∞') {
                  const previousValue = row > 0 ? data[row - 1]?.[weeksKey] : undefined;
                  const isFirstInfinity = row === 0 || previousValue !== '∞';
                  if (isFirstInfinity && !cell.comment) {
                    cell.comment = {
                      value:
                        `Stockout (Weeks) is forward-looking coverage until projected inventory reaches 0.\n` +
                        `∞ means inventory never reaches 0 within the loaded horizon.\n` +
                        `This usually happens when Final Sales is 0 (no demand entered) or inbound covers demand.`,
                      readOnly: true,
                    };
                  }
                }

                if (isStockColumn) {
                  const weeksNumeric = parseNumericInput(rawWeeks);
                  const previousWeeksRaw = row > 0 ? data[row - 1]?.[weeksKey] : undefined;
                  const previousWeeksNumeric = parseNumericInput(previousWeeksRaw);
                  const wasBelowThreshold =
                    previousWeeksNumeric != null && previousWeeksNumeric <= warningThreshold;
                  const isBelowThreshold = weeksNumeric != null && weeksNumeric <= warningThreshold;

                  const nextWeeksRaw =
                    row + 1 < data.length ? data[row + 1]?.[weeksKey] : undefined;
                  const nextWeeksNumeric = parseNumericInput(nextWeeksRaw);
                  const willBeBelowThreshold =
                    nextWeeksNumeric != null && nextWeeksNumeric <= warningThreshold;

                  const isWarningStart = isBelowThreshold && !wasBelowThreshold;
                  const isWarningEnd = isBelowThreshold && !willBeBelowThreshold;

                  if (isBelowThreshold) {
                    cell.className = `${cell.className} cell-warning`;
                    if (isWarningStart) cell.className = `${cell.className} cell-warning-start`;
                    if (isWarningEnd) cell.className = `${cell.className} cell-warning-end`;

                    const leadProfile = leadTimeByProduct[productId];
                    const leadTimeWeeks = leadProfile
                      ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks)))
                      : 0;
                    if (
                      Number.isFinite(weekNumber) &&
                      isWarningStart &&
                      leadTimeWeeks > 0 &&
                      !cell.comment
                    ) {
                      const startWeekRaw = weekNumber - leadTimeWeeks;
                      const startDate =
                        weekDateByNumber.get(startWeekRaw) || formatWeekDateFallback(startWeekRaw);
                      const leadBreakdown = leadProfile
                        ? `${leadTimeWeeks}w (prod ${leadProfile.productionWeeks}w + source ${leadProfile.sourceWeeks}w + ocean ${leadProfile.oceanWeeks}w + final ${leadProfile.finalWeeks}w)`
                        : `${leadTimeWeeks}w`;

                      cell.comment = {
                        value:
                          `Low stock warning (≤ ${warningThreshold}w).\n` +
                          `Suggested production start: ${startDate}.\n` +
                          `Lead time: ${leadBreakdown}.`,
                        readOnly: true,
                      };
                    }
                  }

                  if (isReorderWeek && reorderInfo && !cell.comment) {
                    const leadProfile = leadTimeByProduct[productId];
                    const leadTimeWeeks = leadProfile
                      ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks)))
                      : (reorderInfo.leadTimeWeeks ?? 0);
                    const leadBreakdown = leadProfile
                      ? `${leadTimeWeeks}w (prod ${leadProfile.productionWeeks}w + source ${leadProfile.sourceWeeks}w + ocean ${leadProfile.oceanWeeks}w + final ${leadProfile.finalWeeks}w)`
                      : `${leadTimeWeeks}w`;

                    const startLabel =
                      reorderInfo.startYear != null && reorderInfo.startWeekLabel != null
                        ? `${reorderInfo.startYear} W${reorderInfo.startWeekLabel}${reorderInfo.startDate ? ` (${reorderInfo.startDate})` : ''}`
                        : reorderInfo.startDate || `Week ${reorderInfo.startWeekNumber}`;

                    const breachLabel =
                      reorderInfo.breachYear != null && reorderInfo.breachWeekLabel != null
                        ? `${reorderInfo.breachYear} W${reorderInfo.breachWeekLabel}${reorderInfo.breachDate ? ` (${reorderInfo.breachDate})` : ''}`
                        : reorderInfo.breachDate || `Week ${reorderInfo.breachWeekNumber}`;

                    cell.comment = {
                      value:
                        `Reorder signal (target ≥ ${warningThreshold}w).\n` +
                        `Start production: ${startLabel}.\n` +
                        `Threshold breach: ${breachLabel}.\n` +
                        `Lead time: ${leadBreakdown}.`,
                      readOnly: true,
                    };
                  }
                }
              }
            }

            if (meta?.field === 'finalSales') {
              const cellKey = `${weekNumber}-${columnKey}`;
              const allocations = batchAllocations.get(cellKey);
              if (allocations && allocations.length > 0) {
                cell.comment = { value: formatBatchComment(allocations) };
              }
            }

            return cell;
          }}
          afterChange={(changes, source) => {
            if (!changes) return;
            const sourceString = String(source);
            if (sourceString === 'loadData' || sourceString === 'derived-update') return;
            const hot = hotRef.current;
            if (!hot) return;
            const changedProductIds = new Set<string>();
            const minRowByProduct = new Map<string, number>();
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
              const formatted = formatNumericInput(newValue);
              entry.values[meta.field] = formatted;
              record[prop] = formatted;
              changedProductIds.add(meta.productId);
              const existingMin = minRowByProduct.get(meta.productId);
              if (existingMin == null || rowIndex < existingMin) {
                minRowByProduct.set(meta.productId, rowIndex);
              }
            }
	            if (changedProductIds.size > 0) {
	              for (const productId of changedProductIds) {
	                recomputeDerivedForProduct(productId, minRowByProduct.get(productId) ?? null);
	              }
	            }
            scheduleFlush();
          }}
          afterSelectionEnd={() => {
            updateSelectionStats();
          }}
          afterDeselect={() => {
            setSelectionStats(null);
          }}
        />
        <SelectionStatsBar stats={selectionStats} />
      </div>
    </div>
  );
}
