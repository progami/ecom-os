'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './transaction-edit-modal.module.css';
import {
  ACCOUNTS,
  SERVICE_TYPES,
  FIELDS,
  DEFAULT_SERVICE_TYPE,
  generateReference,
  generateMemo,
  getServiceTypesForAccount,
  findAccountByName,
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

interface TransactionEditModalProps {
  purchase: Purchase;
  onClose: () => void;
  onSave: (updated: { id: string; reference: string; memo: string; syncToken: string }) => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

export function TransactionEditModal({ purchase, onClose, onSave }: TransactionEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect account from transaction
  const detectedAccount = useMemo(() => findAccountByName(purchase.account), [purchase.account]);

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(detectedAccount?.id || '');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Get service types for selected account
  const serviceTypes = useMemo(() => {
    return selectedAccountId ? getServiceTypesForAccount(selectedAccountId) : [DEFAULT_SERVICE_TYPE];
  }, [selectedAccountId]);

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

  const renderField = (fieldId: string) => {
    const fieldConfig = FIELDS[fieldId];
    if (!fieldConfig) return null;

    const value = fieldValues[fieldId] || '';

    if (fieldConfig.type === 'select' && fieldConfig.options) {
      return (
        <div key={fieldId} className={styles.field}>
          <label className={styles.fieldLabel}>{fieldConfig.label}</label>
          <select
            className={styles.fieldSelect}
            value={value}
            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
          >
            <option value="">Select {fieldConfig.label}</option>
            {fieldConfig.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldConfig.type === 'period') {
      // Generate period options (last 12 months)
      const periods: string[] = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = d.toLocaleString('en-US', { month: 'short' });
        const year = d.getFullYear().toString().slice(-2);
        periods.push(`${monthName}${year}`);
      }

      return (
        <div key={fieldId} className={styles.field}>
          <label className={styles.fieldLabel}>{fieldConfig.label}</label>
          <select
            className={styles.fieldSelect}
            value={value}
            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
          >
            <option value="">Select Period</option>
            {periods.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={fieldId} className={styles.field}>
        <label className={styles.fieldLabel}>{fieldConfig.label}</label>
        <input
          type="text"
          className={styles.fieldInput}
          value={value}
          onChange={(e) => handleFieldChange(fieldId, e.target.value)}
          placeholder={fieldConfig.placeholder}
          maxLength={fieldConfig.maxLength}
        />
      </div>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Transaction</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Transaction Info */}
          <div className={styles.transactionInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Date:</span>
              <span className={styles.infoValue}>{formatDate(purchase.date)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Vendor:</span>
              <span className={styles.infoValue}>{purchase.vendor}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Account:</span>
              <span className={styles.infoValue}>{purchase.account}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Amount:</span>
              <span className={styles.infoValue}>{formatAmount(purchase.amount)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Current Ref:</span>
              <span className={styles.infoValueMono}>{purchase.reference || '(empty)'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Current Memo:</span>
              <span className={styles.infoValueMono}>{purchase.memo || '(empty)'}</span>
            </div>
          </div>

          {/* SOP Selection */}
          <div className={styles.sopSection}>
            <h3 className={styles.sectionTitle}>SOP Configuration</h3>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Account Type</label>
              <select
                className={styles.fieldSelect}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="">Select Account Type</option>
                {ACCOUNTS.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedAccountId && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Service Type</label>
                <select
                  className={styles.fieldSelect}
                  value={selectedServiceTypeId}
                  onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                >
                  {serviceTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                {selectedServiceType?.note && (
                  <p className={styles.fieldNote}>{selectedServiceType.note}</p>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Fields */}
          {selectedServiceType && requiredFields.length > 0 && (
            <div className={styles.fieldsSection}>
              <h3 className={styles.sectionTitle}>Fill in Details</h3>
              <div className={styles.fieldsGrid}>{requiredFields.map(renderField)}</div>
            </div>
          )}

          {/* Preview */}
          {selectedServiceType && (
            <div className={styles.previewSection}>
              <h3 className={styles.sectionTitle}>Preview</h3>
              <div className={styles.preview}>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Reference:</span>
                  <span className={styles.previewValue}>
                    {preview.reference || <span className={styles.previewEmpty}>(empty)</span>}
                  </span>
                  <span className={styles.previewLimit}>{preview.reference.length}/21</span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Memo:</span>
                  <span className={styles.previewValue}>
                    {preview.memo || <span className={styles.previewEmpty}>(empty)</span>}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving || !preview.reference || !preview.memo}
          >
            {saving ? 'Saving...' : 'Save to QBO'}
          </button>
        </div>
      </div>
    </div>
  );
}
