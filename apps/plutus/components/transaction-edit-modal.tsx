'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  FIELDS,
  DEFAULT_SERVICE_TYPE,
  SERVICE_TYPES,
  generateReference,
  generateMemo,
  type ServiceTypeConfig,
} from '@/lib/sop/config';

interface Purchase {
  id: string;
  syncToken: string;
  date: string;
  amount: number;
  paymentType: string;
  reference: string;
  memo: string;
  vendor: string;
  account: string;
  accountId?: string;
}

interface QboAccount {
  id: string;
  name: string;
  type: string;
  subType?: string;
  fullyQualifiedName?: string;
  acctNum?: string;
}

interface TransactionEditModalProps {
  purchase: Purchase;
  onClose: () => void;
  onSave: (updated: { id: string; reference: string; memo: string; syncToken: string }) => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

async function fetchQboAccounts(): Promise<QboAccount[]> {
  const res = await fetch(`${basePath}/api/qbo/accounts`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const data = await res.json();
  return data.accounts;
}

export function TransactionEditModal({ purchase, onClose, onSave }: TransactionEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch QBO accounts
  const { data: qboAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['qbo-accounts'],
    queryFn: fetchQboAccounts,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Find matching account from QBO accounts based on transaction's account name
  const detectedAccount = useMemo(() => {
    if (!qboAccounts.length) return undefined;
    const txnAccountName = purchase.account.toLowerCase();
    return qboAccounts.find((acc) =>
      txnAccountName.includes(acc.name.toLowerCase()) ||
      (acc.acctNum && txnAccountName.includes(acc.acctNum))
    );
  }, [qboAccounts, purchase.account]);

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Set detected account when accounts load
  useEffect(() => {
    if (detectedAccount && !selectedAccountId) {
      setSelectedAccountId(detectedAccount.id);
    }
  }, [detectedAccount, selectedAccountId]);

  // Get selected QBO account
  const selectedQboAccount = useMemo(() => {
    return qboAccounts.find((acc) => acc.id === selectedAccountId);
  }, [qboAccounts, selectedAccountId]);

  // Get service types for selected account (match by account name or use default)
  const serviceTypes = useMemo(() => {
    if (!selectedQboAccount) return [DEFAULT_SERVICE_TYPE];
    // Try to match by account number or name to existing SERVICE_TYPES config
    const acctNum = selectedQboAccount.acctNum;
    if (acctNum && SERVICE_TYPES[acctNum]) {
      return SERVICE_TYPES[acctNum];
    }
    // Fallback to default
    return [DEFAULT_SERVICE_TYPE];
  }, [selectedQboAccount]);

  // Get selected service type config
  const selectedServiceType = useMemo<ServiceTypeConfig | undefined>(() => {
    return serviceTypes.find((st) => st.id === selectedServiceTypeId);
  }, [serviceTypes, selectedServiceTypeId]);

  // Get all required fields for current selection
  const requiredFields = useMemo(() => {
    if (!selectedServiceType) return [];
    const allFields = [...selectedServiceType.referenceFields, ...selectedServiceType.memoFields];
    return [...new Set(allFields)];
  }, [selectedServiceType]);

  // Generate preview
  const preview = useMemo(() => {
    if (!selectedServiceType) {
      return { reference: '', memo: '' };
    }
    return {
      reference: generateReference(selectedServiceType.referenceTemplate, fieldValues),
      memo: generateMemo(selectedServiceType.memoTemplate, fieldValues),
    };
  }, [selectedServiceType, fieldValues]);

  // Reset service type when account changes
  useEffect(() => {
    if (serviceTypes.length > 0 && !serviceTypes.find((st) => st.id === selectedServiceTypeId)) {
      setSelectedServiceTypeId(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedServiceTypeId]);

  // Initialize field values with vendor name as shortTag
  useEffect(() => {
    setFieldValues((prev) => ({
      ...prev,
      shortTag: prev.shortTag || purchase.vendor,
      vendor: prev.vendor || purchase.vendor,
    }));
  }, [purchase.vendor]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${basePath}/api/qbo/purchases/${purchase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncToken: purchase.syncToken,
          paymentType: purchase.paymentType,
          reference: preview.reference,
          memo: preview.memo,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update transaction');
      }

      const data = await res.json();
      onSave({
        id: purchase.id,
        reference: data.purchase.reference,
        memo: data.purchase.memo,
        syncToken: data.purchase.syncToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Generate period options (last 12 months)
  const periodOptions = useMemo(() => {
    const periods: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear().toString().slice(-2);
      periods.push(`${monthName}${year}`);
    }
    return periods;
  }, []);

  const renderField = (fieldId: string) => {
    const fieldConfig = FIELDS[fieldId];
    if (!fieldConfig) return null;

    const value = fieldValues[fieldId] || '';

    if (fieldConfig.type === 'select' && fieldConfig.options) {
      return (
        <div key={fieldId} className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {fieldConfig.label}
          </label>
          <Select value={value} onValueChange={(v) => handleFieldChange(fieldId, v)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${fieldConfig.label}`} />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (fieldConfig.type === 'period') {
      return (
        <div key={fieldId} className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {fieldConfig.label}
          </label>
          <Select value={value} onValueChange={(v) => handleFieldChange(fieldId, v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((period) => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={fieldId} className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {fieldConfig.label}
        </label>
        <Input
          type="text"
          value={value}
          onChange={(e) => handleFieldChange(fieldId, e.target.value)}
          placeholder={fieldConfig.placeholder}
          maxLength={fieldConfig.maxLength}
        />
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Transaction</DialogTitle>
          <DialogDescription>
            Configure SOP compliance fields for this transaction
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Transaction Summary */}
          <div className="rounded-lg border bg-slate-50 dark:bg-white/5 p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Date</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatDate(purchase.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Amount</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{formatAmount(purchase.amount)}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Vendor</span>
                <span className="font-medium text-slate-900 dark:text-white">{purchase.vendor}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Account</span>
                <span className="text-slate-700 dark:text-slate-300">{purchase.account}</span>
              </div>
              <div className="flex justify-between col-span-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400">Current Ref</span>
                <code className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {purchase.reference || '(empty)'}
                </code>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Current Memo</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {purchase.memo || <span className="italic text-slate-400">(empty)</span>}
                </span>
              </div>
            </div>
          </div>

          {/* SOP Configuration */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              SOP Configuration
            </h4>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Account Type
              </label>
              {accountsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Account Type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {qboAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.acctNum ? `${acc.acctNum} - ` : ''}{acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedAccountId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Service Type
                </label>
                <Select value={selectedServiceTypeId} onValueChange={setSelectedServiceTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Service Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedServiceType?.note && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {selectedServiceType.note}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Fields */}
          {selectedServiceType && requiredFields.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fill in Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {requiredFields.map(renderField)}
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedServiceType && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Preview
              </h4>
              <div className="rounded-lg border border-brand-teal-200 dark:border-brand-cyan/30 bg-brand-teal-50/50 dark:bg-brand-cyan/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400 min-w-[70px]">Reference</span>
                    <code className={cn(
                      "text-sm font-mono px-2 py-1 rounded",
                      preview.reference
                        ? "bg-brand-teal-100 dark:bg-brand-cyan/20 text-brand-teal-700 dark:text-brand-cyan"
                        : "bg-slate-100 dark:bg-white/10 text-slate-400 italic"
                    )}>
                      {preview.reference || '(empty)'}
                    </code>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {preview.reference.length}/21
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400 min-w-[70px]">Memo</span>
                  <span className={cn(
                    "text-sm",
                    preview.memo
                      ? "text-brand-teal-700 dark:text-brand-cyan"
                      : "text-slate-400 italic"
                  )}>
                    {preview.memo || '(empty)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-950/50 p-4">
              <p className="text-sm text-danger-700 dark:text-danger-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !preview.reference || !preview.memo}
            className="bg-brand-teal-600 hover:bg-brand-teal-700 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white"
          >
            {saving ? 'Saving...' : 'Save to QuickBooks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
