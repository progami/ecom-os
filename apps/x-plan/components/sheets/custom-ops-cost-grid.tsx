'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { toast } from 'sonner';
import { useMutationQueue } from '@/hooks/useMutationQueue';
import { usePersistentState } from '@/hooks/usePersistentState';
import { usePersistentScroll } from '@/hooks/usePersistentScroll';
import { readClipboardText } from '@/lib/grid/clipboard';
import { cn } from '@/lib/utils';
import {
  formatNumericInput,
  formatPercentInput,
  sanitizeNumeric,
} from '@/components/sheets/validators';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { withAppBasePath } from '@/lib/base-path';

export type OpsBatchRow = {
  id: string;
  purchaseOrderId: string;
  orderCode: string;
  batchCode?: string;
  productId: string;
  productName: string;
  quantity: string;
  sellingPrice: string;
  manufacturingCost: string;
  freightCost: string;
  tariffRate: string;
  tariffCost: string;
  tacosPercent: string;
  fbaFee: string;
  referralRate: string;
  storagePerMonth: string;
};

interface CustomOpsCostGridProps {
  rows: OpsBatchRow[];
  activeOrderId?: string | null;
  activeBatchId?: string | null;
  scrollKey?: string | null;
  onSelectOrder?: (orderId: string) => void;
  onSelectBatch?: (batchId: string) => void;
  onRowsChange?: (rows: OpsBatchRow[]) => void;
  onAddBatch?: () => void;
  onDeleteBatch?: () => void;
  disableAdd?: boolean;
  disableDelete?: boolean;
  products: Array<{ id: string; name: string }>;
  onSync?: () => void;
}

const NUMERIC_FIELDS = [
  'quantity',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffCost',
  'fbaFee',
  'storagePerMonth',
] as const;
type NumericField = (typeof NUMERIC_FIELDS)[number];

const NUMERIC_PRECISION: Record<NumericField, number> = {
  quantity: 0,
  sellingPrice: 2,
  manufacturingCost: 3,
  freightCost: 3,
  tariffCost: 3,
  fbaFee: 3,
  storagePerMonth: 3,
};

const PERCENT_FIELDS = ['tariffRate', 'tacosPercent', 'referralRate'] as const;
type PercentField = (typeof PERCENT_FIELDS)[number];

const PERCENT_PRECISION: Record<PercentField, number> = {
  tariffRate: 2,
  tacosPercent: 2,
  referralRate: 2,
};

const NUMERIC_FIELD_SET = new Set<string>(NUMERIC_FIELDS);
const PERCENT_FIELD_SET = new Set<string>(PERCENT_FIELDS);

const SERVER_FIELD_MAP: Partial<Record<keyof OpsBatchRow, string>> = {
  quantity: 'quantity',
  sellingPrice: 'overrideSellingPrice',
  manufacturingCost: 'overrideManufacturingCost',
  freightCost: 'overrideFreightCost',
  tariffRate: 'overrideTariffRate',
  tariffCost: 'overrideTariffCost',
  tacosPercent: 'overrideTacosPercent',
  fbaFee: 'overrideFbaFee',
  referralRate: 'overrideReferralRate',
  storagePerMonth: 'overrideStoragePerMonth',
};

function isNumericField(field: keyof OpsBatchRow): field is NumericField {
  return NUMERIC_FIELD_SET.has(field as string);
}

function isPercentField(field: keyof OpsBatchRow): field is PercentField {
  return PERCENT_FIELD_SET.has(field as string);
}

function normalizeCurrency(value: unknown, fractionDigits = 2): string {
  return formatNumericInput(value, fractionDigits);
}

function normalizePercent(value: unknown, fractionDigits = 4): string {
  return formatPercentInput(value, fractionDigits);
}

function validateNumeric(value: string): boolean {
  if (!value || value.trim() === '') return true;
  const parsed = sanitizeNumeric(value);
  return !Number.isNaN(parsed);
}

type ColumnDef = {
  key: keyof OpsBatchRow;
  header: string;
  width: number;
  type: 'text' | 'numeric' | 'percent' | 'dropdown';
  editable: boolean;
  precision?: number;
};

const COLUMNS_BEFORE_TARIFF: ColumnDef[] = [
  { key: 'orderCode', header: 'PO Code', width: 140, type: 'text', editable: false },
  { key: 'productName', header: 'Product', width: 200, type: 'dropdown', editable: true },
  { key: 'quantity', header: 'Qty', width: 110, type: 'numeric', editable: true, precision: 0 },
  {
    key: 'sellingPrice',
    header: 'Sell $',
    width: 120,
    type: 'numeric',
    editable: true,
    precision: 2,
  },
  {
    key: 'manufacturingCost',
    header: 'Mfg $',
    width: 120,
    type: 'numeric',
    editable: true,
    precision: 3,
  },
  {
    key: 'freightCost',
    header: 'Freight $',
    width: 120,
    type: 'numeric',
    editable: true,
    precision: 3,
  },
];

const TARIFF_RATE_COLUMN: ColumnDef = {
  key: 'tariffRate',
  header: 'Tariff %',
  width: 110,
  type: 'percent',
  editable: true,
  precision: 2,
};

const TARIFF_COST_COLUMN: ColumnDef = {
  key: 'tariffCost',
  header: 'Tariff $/unit',
  width: 120,
  type: 'numeric',
  editable: true,
  precision: 3,
};

const COLUMNS_AFTER_TARIFF: ColumnDef[] = [
  {
    key: 'tacosPercent',
    header: 'TACoS %',
    width: 110,
    type: 'percent',
    editable: true,
    precision: 2,
  },
  { key: 'fbaFee', header: 'FBA $', width: 110, type: 'numeric', editable: true, precision: 3 },
  {
    key: 'referralRate',
    header: 'Referral %',
    width: 110,
    type: 'percent',
    editable: true,
    precision: 2,
  },
  {
    key: 'storagePerMonth',
    header: 'Storage $',
    width: 120,
    type: 'numeric',
    editable: true,
    precision: 3,
  },
];

type TariffInputMode = 'rate' | 'cost';

const CELL_ID_PREFIX = 'xplan-ops-batch';

function sanitizeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function cellDomId(rowId: string, colKey: keyof OpsBatchRow): string {
  return `${CELL_ID_PREFIX}:${sanitizeDomId(rowId)}:${String(colKey)}`;
}

export function CustomOpsCostGrid({
  rows,
  activeOrderId,
  activeBatchId,
  scrollKey,
  onSelectOrder,
  onSelectBatch,
  onRowsChange,
  onAddBatch,
  onDeleteBatch,
  disableAdd,
  disableDelete,
  products,
  onSync,
}: CustomOpsCostGridProps) {
  const [tariffInputMode, setTariffInputMode] = usePersistentState<TariffInputMode>(
    'xplan:ops:batch-tariff-mode',
    'rate',
  );
  const columns = useMemo(() => {
    const tariffColumn = tariffInputMode === 'cost' ? TARIFF_COST_COLUMN : TARIFF_RATE_COLUMN;
    return [...COLUMNS_BEFORE_TARIFF, tariffColumn, ...COLUMNS_AFTER_TARIFF];
  }, [tariffInputMode]);

  const [localRows, setLocalRows] = useState<OpsBatchRow[]>(rows);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    colKey: keyof OpsBatchRow;
  } | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: keyof OpsBatchRow } | null>(
    null,
  );
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteStartRef = useRef<{ rowId: string; colKey: keyof OpsBatchRow } | null>(null);

  usePersistentScroll(scrollKey ?? null, true, () => tableScrollRef.current);

  // Keep a local copy to avoid UI flicker when parent props refresh after saving.
  useEffect(() => {
    setLocalRows((previous) => {
      if (previous.length === 0) return rows;
      const byId = new Map(previous.map((row) => [row.id, row]));
      let changed = false;
      for (const row of rows) {
        const existing = byId.get(row.id);
        const serializedExisting = existing ? JSON.stringify(existing) : null;
        const serializedIncoming = JSON.stringify(row);
        if (serializedExisting !== serializedIncoming) {
          byId.set(row.id, row);
          changed = true;
        }
      }
      return changed ? rows.map((row) => byId.get(row.id) ?? row) : previous;
    });
  }, [rows]);

  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string | null> }>) => {
      if (payload.length === 0) return;
      // Filter out items that no longer exist in the current rows
      const existingIds = new Set(localRows.map((r) => r.id));
      const validPayload = payload.filter((item) => existingIds.has(item.id));
      if (validPayload.length === 0) return;
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/purchase-orders/batches'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: validPayload }),
        });
        if (!response.ok) throw new Error('Failed to update batch cost overrides');
        toast.success('Batch cost saved', { id: 'batch-cost-saved' });
        onSync?.();
      } catch (error) {
        console.error(error);
        toast.error('Unable to save batch costs', { id: 'batch-cost-error' });
      }
    },
    [localRows, onSync],
  );

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string | null> }
  >({
    debounceMs: 500,
    onFlush: handleFlush,
  });

  const flushNowRef = useRef(flushNow);
  useEffect(() => {
    flushNowRef.current = flushNow;
  }, [flushNow]);

  useEffect(() => {
    return () => {
      flushNowRef.current().catch(() => {});
    };
  }, []); // Only run cleanup on unmount

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  const startEditing = (rowId: string, colKey: keyof OpsBatchRow, currentValue: string) => {
    setActiveCell({ rowId, colKey });
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue);
  };

  const cancelEditing = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    requestAnimationFrame(() => {
      tableScrollRef.current?.focus();
    });
  }, []);

  const toggleTariffInputMode = useCallback(() => {
    cancelEditing();
    setTariffInputMode((previous) => (previous === 'rate' ? 'cost' : 'rate'));
  }, [cancelEditing, setTariffInputMode]);

  const commitEdit = useCallback(
    (overrideValue?: string) => {
      if (!editingCell) return;

      const { rowId, colKey } = editingCell;
      const row = localRows.find((r) => r.id === rowId);
      if (!row) {
        cancelEditing();
        return;
      }

      const column = columns.find((c) => c.key === colKey);
      if (!column) {
        cancelEditing();
        return;
      }

      let finalValue = overrideValue ?? editValue;

      // Validate and normalize based on column type
      if (column.type === 'numeric') {
        if (!validateNumeric(finalValue)) {
          toast.error('Invalid number');
          cancelEditing();
          return;
        }
        const precision = column.precision ?? NUMERIC_PRECISION[colKey as NumericField] ?? 2;
        finalValue = normalizeCurrency(finalValue, precision);
      } else if (column.type === 'percent') {
        if (!validateNumeric(finalValue)) {
          toast.error('Invalid percentage');
          cancelEditing();
          return;
        }
        const precision = column.precision ?? PERCENT_PRECISION[colKey as PercentField] ?? 4;
        finalValue = normalizePercent(finalValue, precision);
      } else if (column.type === 'dropdown') {
        // Handle product selection
        const selected = products.find((p) => p.name === finalValue);
        if (!selected && finalValue) {
          toast.error('Select a valid product');
          cancelEditing();
          return;
        }
      }

      // Don't update if value hasn't changed
      if (row[colKey] === finalValue) {
        cancelEditing();
        return;
      }

      // Prepare mutation entry
      if (!pendingRef.current.has(rowId)) {
        pendingRef.current.set(rowId, { id: rowId, values: {} });
      }
      const entry = pendingRef.current.get(rowId)!;

      // Create updated row
      const updatedRow = { ...row };

      if (colKey === 'productName') {
        const selected = products.find((p) => p.name === finalValue);
        if (selected) {
          entry.values.productId = selected.id;
          updatedRow.productId = selected.id;
          updatedRow.productName = selected.name;
        }
      } else if (colKey === 'tariffCost') {
        entry.values.overrideTariffCost = finalValue === '' ? null : finalValue;
        entry.values.overrideTariffRate = null;
        updatedRow.tariffCost = finalValue;
        updatedRow.tariffRate = '';
      } else if (colKey === 'tariffRate') {
        entry.values.overrideTariffRate = finalValue === '' ? null : finalValue;
        entry.values.overrideTariffCost = null;
        updatedRow.tariffRate = finalValue;
        updatedRow.tariffCost = '';
      } else if (isNumericField(colKey)) {
        const serverKey = SERVER_FIELD_MAP[colKey];
        if (serverKey) {
          entry.values[serverKey] = finalValue === '' ? null : finalValue;
        }
        updatedRow[colKey] = finalValue;
      } else if (isPercentField(colKey)) {
        const serverKey = SERVER_FIELD_MAP[colKey];
        if (serverKey) {
          entry.values[serverKey] = finalValue === '' ? null : finalValue;
        }
        updatedRow[colKey] = finalValue;
      }

      // Update rows
      const updatedRows = localRows.map((r) => (r.id === rowId ? updatedRow : r));
      setLocalRows(updatedRows);
      onRowsChange?.(updatedRows);

      scheduleFlush();
      cancelEditing();
    },
    [
      editingCell,
      editValue,
      localRows,
      products,
      pendingRef,
      scheduleFlush,
      onRowsChange,
      columns,
      cancelEditing,
    ],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      moveSelection(1, 0);
      requestAnimationFrame(() => {
        tableScrollRef.current?.focus();
      });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
      requestAnimationFrame(() => {
        tableScrollRef.current?.focus();
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      moveSelectionTab(e.shiftKey ? -1 : 1);
      requestAnimationFrame(() => {
        tableScrollRef.current?.focus();
      });
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditValue(e.target.value);
  };

  const handleCellClick = (row: OpsBatchRow, column: ColumnDef) => {
    onSelectOrder?.(row.purchaseOrderId);
    onSelectBatch?.(row.id);
    tableScrollRef.current?.focus();
    setActiveCell({ rowId: row.id, colKey: column.key });
  };

  const handleCellBlur = () => {
    commitEdit();
  };

  const scrollToCell = useCallback((rowId: string, colKey: keyof OpsBatchRow) => {
    requestAnimationFrame(() => {
      const node = document.getElementById(cellDomId(rowId, colKey));
      node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, []);

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      if (!activeCell) return;

      const currentRowIndex = rows.findIndex((row) => row.id === activeCell.rowId);
      const currentColIndex = columns.findIndex((column) => column.key === activeCell.colKey);
      if (currentRowIndex < 0 || currentColIndex < 0) return;

      const nextRowIndex = Math.max(0, Math.min(rows.length - 1, currentRowIndex + deltaRow));
      const nextColIndex = Math.max(0, Math.min(columns.length - 1, currentColIndex + deltaCol));

      const nextRow = rows[nextRowIndex];
      const nextColKey = columns[nextColIndex]?.key;
      if (!nextRow || !nextColKey) return;

      setActiveCell({ rowId: nextRow.id, colKey: nextColKey });
      onSelectOrder?.(nextRow.purchaseOrderId);
      onSelectBatch?.(nextRow.id);
      scrollToCell(nextRow.id, nextColKey);
    },
    [activeCell, columns, onSelectBatch, onSelectOrder, rows, scrollToCell],
  );

  const moveSelectionTab = useCallback(
    (direction: 1 | -1) => {
      if (!activeCell) return;

      const currentRowIndex = rows.findIndex((row) => row.id === activeCell.rowId);
      const currentColIndex = columns.findIndex((column) => column.key === activeCell.colKey);
      if (currentRowIndex < 0 || currentColIndex < 0) return;

      let nextRowIndex = currentRowIndex;
      let nextColIndex = currentColIndex + direction;

      if (nextColIndex >= columns.length) {
        nextColIndex = 0;
        nextRowIndex = Math.min(rows.length - 1, currentRowIndex + 1);
      } else if (nextColIndex < 0) {
        nextColIndex = columns.length - 1;
        nextRowIndex = Math.max(0, currentRowIndex - 1);
      }

      const nextRow = rows[nextRowIndex];
      const nextColKey = columns[nextColIndex]?.key;
      if (!nextRow || !nextColKey) return;

      setActiveCell({ rowId: nextRow.id, colKey: nextColKey });
      onSelectOrder?.(nextRow.purchaseOrderId);
      onSelectBatch?.(nextRow.id);
      scrollToCell(nextRow.id, nextColKey);
    },
    [activeCell, columns, onSelectBatch, onSelectOrder, rows, scrollToCell],
  );

  const startEditingActiveCell = useCallback(() => {
    if (!activeCell) return;
    const row = rows.find((r) => r.id === activeCell.rowId);
    const column = columns.find((c) => c.key === activeCell.colKey);
    if (!row || !column) return;
    if (!column.editable) return;
    startEditing(row.id, column.key, row[column.key] ?? '');
  }, [activeCell, columns, rows]);

  const buildClipboardText = useCallback(() => {
    if (!activeCell) return '';
    const row = localRows.find((item) => item.id === activeCell.rowId);
    if (!row) return '';
    const value = row[activeCell.colKey];
    return value ?? '';
  }, [activeCell, localRows]);

  const copySelectionToClipboard = useCallback(() => {
    const text = buildClipboardText();
    if (!text) return;

    const clipboard = clipboardRef.current;
    if (!clipboard) {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).catch(() => {});
      }
      return;
    }

    clipboard.value = text;
    clipboard.focus();
    clipboard.select();

    try {
      const didCopy = document.execCommand('copy');
      if (!didCopy && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).catch(() => {});
      }
    } finally {
      clipboard.value = '';
      requestAnimationFrame(() => tableScrollRef.current?.focus());
    }
  }, [buildClipboardText]);

  const applyPastedText = useCallback(
    (text: string, start: { rowId: string; colKey: keyof OpsBatchRow }) => {
      const startRowIndex = localRows.findIndex((row) => row.id === start.rowId);
      const startColIndex = columns.findIndex((column) => column.key === start.colKey);
      if (startRowIndex < 0 || startColIndex < 0) return;

      const matrix = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => line.split('\t'));

      if (matrix.length === 0) return;

      let updatedRows = [...localRows];
      let applied = 0;
      let skipped = 0;

      for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix[r]!.length; c += 1) {
          const targetRowIndex = startRowIndex + r;
          const targetColIndex = startColIndex + c;
          if (targetRowIndex >= updatedRows.length) continue;
          if (targetColIndex >= columns.length) continue;

          const column = columns[targetColIndex];
          if (!column?.editable) continue;

          const row = updatedRows[targetRowIndex];
          if (!row) continue;

          const rawValue = matrix[r]![c] ?? '';
          let finalValue = rawValue;

          if (column.type === 'numeric') {
            if (!validateNumeric(finalValue)) {
              skipped += 1;
              continue;
            }
            const precision =
              column.precision ?? NUMERIC_PRECISION[column.key as NumericField] ?? 2;
            finalValue = normalizeCurrency(finalValue, precision);
          } else if (column.type === 'percent') {
            if (!validateNumeric(finalValue)) {
              skipped += 1;
              continue;
            }
            const precision =
              column.precision ?? PERCENT_PRECISION[column.key as PercentField] ?? 4;
            finalValue = normalizePercent(finalValue, precision);
          } else if (column.type === 'dropdown') {
            if (finalValue && !products.some((product) => product.name === finalValue)) {
              skipped += 1;
              continue;
            }
          }

          const currentValue = row[column.key] ?? '';
          if (currentValue === finalValue) continue;

          if (!pendingRef.current.has(row.id)) {
            pendingRef.current.set(row.id, { id: row.id, values: {} });
          }
          const entry = pendingRef.current.get(row.id)!;

          const nextRow = { ...row };

          if (column.key === 'productName') {
            const selected = products.find((product) => product.name === finalValue);
            if (!selected) continue;
            entry.values.productId = selected.id;
            nextRow.productId = selected.id;
            nextRow.productName = selected.name;
          } else if (column.key === 'tariffCost') {
            entry.values.overrideTariffCost = finalValue === '' ? null : finalValue;
            entry.values.overrideTariffRate = null;
            nextRow.tariffCost = finalValue;
            nextRow.tariffRate = '';
          } else if (column.key === 'tariffRate') {
            entry.values.overrideTariffRate = finalValue === '' ? null : finalValue;
            entry.values.overrideTariffCost = null;
            nextRow.tariffRate = finalValue;
            nextRow.tariffCost = '';
          } else if (isNumericField(column.key) || isPercentField(column.key)) {
            const serverKey = SERVER_FIELD_MAP[column.key];
            if (serverKey) {
              entry.values[serverKey] = finalValue === '' ? null : finalValue;
            }
            nextRow[column.key] = finalValue;
          }

          updatedRows[targetRowIndex] = nextRow;
          applied += 1;
        }
      }

      if (applied === 0) return;

      setLocalRows(updatedRows);
      onRowsChange?.(updatedRows);
      scheduleFlush();

      toast.success(`Pasted ${applied} cell${applied === 1 ? '' : 's'}`);
      if (skipped > 0) {
        toast.warning(`Skipped ${skipped} cell${skipped === 1 ? '' : 's'}`, {
          description: 'Some values could not be applied.',
        });
      }
    },
    [columns, localRows, onRowsChange, pendingRef, products, scheduleFlush],
  );

  const handleCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      const text = buildClipboardText();
      if (!text) return;
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    },
    [buildClipboardText],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      const clipboard = clipboardRef.current;
      const shouldRefocus = Boolean(clipboard && event.currentTarget === clipboard);
      const refocus = () => {
        if (!shouldRefocus) return;
        if (clipboard) clipboard.value = '';
        requestAnimationFrame(() => tableScrollRef.current?.focus());
      };

      const start = pasteStartRef.current ?? activeCell;
      pasteStartRef.current = null;
      if (!start) {
        refocus();
        return;
      }

      const text = event.clipboardData.getData('text/plain');
      event.preventDefault();
      if (!text) {
        refocus();
        return;
      }

      applyPastedText(text, start);
      refocus();
    },
    [activeCell, applyPastedText],
  );

  const handleGridKeyDown = useCallback(
    (event: {
      key: string;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      preventDefault: () => void;
    }) => {
      if (editingCell) return;
      if (!activeCell) return;

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const start = { ...activeCell };
        void (async () => {
          const text = await readClipboardText();
          if (!text) return;
          applyPastedText(text, start);
        })();
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();

        const { rowId, colKey } = activeCell;
        const row = localRows.find((r) => r.id === rowId);
        const column = columns.find((c) => c.key === colKey);
        if (!row || !column || !column.editable) return;
        if (column.type === 'dropdown') return;
        if ((row[colKey] ?? '') === '') return;

        if (!pendingRef.current.has(rowId)) {
          pendingRef.current.set(rowId, { id: rowId, values: {} });
        }
        const entry = pendingRef.current.get(rowId)!;

        const updatedRow = { ...row };

        if (colKey === 'tariffCost') {
          entry.values.overrideTariffCost = null;
          entry.values.overrideTariffRate = null;
          updatedRow.tariffCost = '';
          updatedRow.tariffRate = '';
        } else if (colKey === 'tariffRate') {
          entry.values.overrideTariffRate = null;
          entry.values.overrideTariffCost = null;
          updatedRow.tariffRate = '';
          updatedRow.tariffCost = '';
        } else if (isNumericField(colKey) || isPercentField(colKey)) {
          const serverKey = SERVER_FIELD_MAP[colKey];
          if (serverKey) {
            entry.values[serverKey] = null;
          }
          updatedRow[colKey] = '';
        }

        const nextRows = localRows.map((r) => (r.id === rowId ? updatedRow : r));
        setLocalRows(nextRows);
        onRowsChange?.(nextRows);
        scheduleFlush();
        return;
      }

      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault();
        startEditingActiveCell();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        moveSelectionTab(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1, 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1, 0);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(0, 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(0, -1);
        return;
      }
    },
    [
      activeCell,
      columns,
      copySelectionToClipboard,
      editingCell,
      localRows,
      moveSelection,
      moveSelectionTab,
      onRowsChange,
      pendingRef,
      scheduleFlush,
      startEditingActiveCell,
      applyPastedText,
    ],
  );

  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      handleGridKeyDown(event);
    },
    [handleGridKeyDown],
  );

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value;
    setEditValue(nextValue);
    // Commit with the selected value (avoid stale `editValue` closures)
    commitEdit(nextValue);
  };

  const formatDisplayValue = (row: OpsBatchRow, column: ColumnDef): string => {
    const value = row[column.key];
    if (!value) return '';

    if (column.type === 'numeric') {
      const num = sanitizeNumeric(value);
      if (Number.isNaN(num)) return value;
      if (column.key === 'quantity') return num.toLocaleString();
      return `$${num.toFixed(column.precision ?? 2)}`;
    }

    if (column.type === 'percent') {
      const num = sanitizeNumeric(value);
      if (Number.isNaN(num)) return value;
      return `${(num * 100).toFixed(column.precision ?? 2)}%`;
    }

    return value;
  };

  const renderCell = (row: OpsBatchRow, column: ColumnDef, colIndex: number) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === column.key;
    const isCurrent = activeCell?.rowId === row.id && activeCell?.colKey === column.key;
    const displayValue = formatDisplayValue(row, column);

    const isNumericCell = column.type === 'numeric' || column.type === 'percent';
    const isDropdown = column.type === 'dropdown';
    const isRowSelected = isRowActive(row);

    const cellClassName = cn(
      'h-9 overflow-hidden whitespace-nowrap border-r p-0 align-middle text-sm',
      colIndex === 0 && isRowSelected && 'border-l-4 border-cyan-600 dark:border-cyan-400',
      isNumericCell && 'text-right',
      column.editable
        ? isDropdown
          ? 'cursor-pointer bg-accent/50 font-medium'
          : 'cursor-text bg-accent/50 font-medium'
        : 'bg-muted/50 text-muted-foreground',
      (isEditing || isCurrent) && 'ring-2 ring-inset ring-ring',
      colIndex === columns.length - 1 && 'border-r-0',
    );

    const inputClassName = cn(
      'h-9 w-full bg-transparent px-3 text-sm font-semibold text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-inset focus:ring-ring',
      isNumericCell && 'text-right',
    );

    if (isEditing) {
      if (column.type === 'dropdown') {
        return (
          <TableCell
            key={column.key}
            id={cellDomId(row.id, column.key)}
            className={cellClassName}
            style={{ width: column.width, minWidth: column.width }}
          >
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={editValue}
              onChange={handleSelectChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCellBlur}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              className="h-9 w-full bg-transparent px-3 text-sm font-medium text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-inset focus:ring-ring"
            >
              <option value="">Select product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
          </TableCell>
        );
      }

      return (
        <TableCell
          key={column.key}
          id={cellDomId(row.id, column.key)}
          className={cellClassName}
          style={{ width: column.width, minWidth: column.width }}
        >
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleCellBlur}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            className={inputClassName}
            placeholder={column.type === 'percent' ? 'e.g. 10 for 10%' : undefined}
          />
        </TableCell>
      );
    }

    return (
      <TableCell
        key={column.key}
        id={cellDomId(row.id, column.key)}
        className={cellClassName}
        style={{ width: column.width, minWidth: column.width }}
        title={displayValue || undefined}
        onClick={(event) => {
          event.stopPropagation();
          handleCellClick(row, column);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!column.editable) return;
          startEditing(row.id, column.key, row[column.key] ?? '');
        }}
      >
        <div className={cn('flex h-9 min-w-0 items-center px-3', isNumericCell && 'justify-end')}>
          <span className={cn('block min-w-0 truncate', isNumericCell && 'tabular-nums')}>
            {displayValue}
          </span>
        </div>
      </TableCell>
    );
  };

  const isRowActive = (row: OpsBatchRow): boolean => {
    if (activeBatchId && row.id === activeBatchId) return true;
    if (!activeBatchId && activeOrderId && row.purchaseOrderId === activeOrderId) return true;
    return false;
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            Batch Table
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddBatch ? (
            <button
              type="button"
              onClick={onAddBatch}
              disabled={Boolean(disableAdd)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add batch
            </button>
          ) : null}
          {onDeleteBatch ? (
            <button
              type="button"
              onClick={onDeleteBatch}
              disabled={Boolean(disableDelete) || !activeBatchId}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:focus:ring-rose-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
            >
              Remove batch
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm dark:border-white/10">
        <textarea
          ref={clipboardRef}
          tabIndex={-1}
          aria-hidden="true"
          className="fixed left-0 top-0 h-1 w-1 opacity-0 pointer-events-none"
          onPaste={handlePaste}
        />
        <div
          ref={tableScrollRef}
          tabIndex={0}
          onPointerDownCapture={() => {
            if (!editingCell) {
              tableScrollRef.current?.focus();
            }
          }}
          onKeyDown={handleTableKeyDown}
          onCopy={handleCopy}
          onPaste={handlePaste}
          className="max-h-[400px] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Table className="table-fixed border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    style={{ width: column.width, minWidth: column.width }}
                    className="sticky top-0 z-10 h-10 whitespace-nowrap border-b border-r bg-muted px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80"
                  >
                    {column.key === 'tariffRate' || column.key === 'tariffCost' ? (
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-cyan-700 transition hover:bg-cyan-500/20 dark:border-cyan-300/35 dark:bg-cyan-300/10 dark:text-cyan-200 dark:hover:bg-cyan-300/20"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleTariffInputMode();
                        }}
                        title={
                          tariffInputMode === 'rate'
                            ? 'Switch to Tariff $/unit'
                            : 'Switch to Tariff %'
                        }
                      >
                        {column.header}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    {activeOrderId
                      ? 'No batches for this order. Click "Add batch" to add cost details.'
                      : 'Select a purchase order above to view or add batches.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'hover:bg-transparent',
                      rowIndex % 2 === 1 && 'bg-muted/30',
                      isRowActive(row) && 'bg-cyan-50/70 dark:bg-cyan-900/20',
                    )}
                  >
                    {columns.map((column, colIndex) => renderCell(row, column, colIndex))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
