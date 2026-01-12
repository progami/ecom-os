'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './transactions.module.css';
import { TransactionEditModal } from '@/components/transaction-edit-modal';

interface Purchase {
  id: string;
  syncToken: string;
  date: string;
  amount: number;
  paymentType: string;
  reference: string;
  memo: string;
  vendor: string;
  vendorId?: string;
  account: string;
  accountId?: string;
  complianceStatus: 'compliant' | 'partial' | 'non-compliant';
  lineItems: Array<{
    id: string;
    amount: number;
    description?: string;
    account?: string;
    accountId?: string;
  }>;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

export default function TransactionsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [filter, setFilter] = useState<'all' | 'compliant' | 'partial' | 'non-compliant'>('all');

  const fetchPurchases = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/qbo/purchases?page=${page}&pageSize=50`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch purchases');
      }
      const data = await res.json();
      setPurchases(data.purchases);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch purchases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handlePageChange = (newPage: number) => {
    fetchPurchases(newPage);
  };

  const handleEdit = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
  };

  const handleCloseModal = () => {
    setSelectedPurchase(null);
  };

  const handleSaveSuccess = (updatedPurchase: { id: string; reference: string; memo: string; syncToken: string }) => {
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === updatedPurchase.id
          ? {
              ...p,
              reference: updatedPurchase.reference,
              memo: updatedPurchase.memo,
              syncToken: updatedPurchase.syncToken,
              complianceStatus: updatedPurchase.reference && updatedPurchase.memo ? 'compliant' : 'partial',
            }
          : p
      )
    );
    setSelectedPurchase(null);
  };

  const filteredPurchases = purchases.filter((p) => {
    if (filter === 'all') return true;
    return p.complianceStatus === filter;
  });

  const complianceCounts = {
    all: purchases.length,
    compliant: purchases.filter((p) => p.complianceStatus === 'compliant').length,
    partial: purchases.filter((p) => p.complianceStatus === 'partial').length,
    'non-compliant': purchases.filter((p) => p.complianceStatus === 'non-compliant').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <span className={styles.statusIconCompliant}>✓</span>;
      case 'partial':
        return <span className={styles.statusIconPartial}>◐</span>;
      case 'non-compliant':
        return <span className={styles.statusIconNonCompliant}>✗</span>;
      default:
        return null;
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => fetchPurchases()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <a href={basePath} className={styles.backLink}>
            ← Back
          </a>
          <h1 className={styles.title}>Transactions</h1>
        </div>
        <div className={styles.headerRight}>
          <button onClick={() => fetchPurchases(pagination.page)} className={styles.refreshButton}>
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({complianceCounts.all})
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'non-compliant' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('non-compliant')}
          >
            <span className={styles.statusIconNonCompliant}>✗</span>
            Missing ({complianceCounts['non-compliant']})
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'partial' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('partial')}
          >
            <span className={styles.statusIconPartial}>◐</span>
            Partial ({complianceCounts.partial})
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'compliant' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('compliant')}
          >
            <span className={styles.statusIconCompliant}>✓</span>
            Compliant ({complianceCounts.compliant})
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading transactions...</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Memo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className={styles.tableRow}>
                    <td>{getStatusIcon(purchase.complianceStatus)}</td>
                    <td>{formatDate(purchase.date)}</td>
                    <td className={styles.vendorCell}>{purchase.vendor}</td>
                    <td className={styles.accountCell}>{purchase.account}</td>
                    <td className={styles.amountCell}>{formatAmount(purchase.amount)}</td>
                    <td className={styles.referenceCell}>
                      {purchase.reference || <span className={styles.empty}>Empty</span>}
                    </td>
                    <td className={styles.memoCell}>
                      {purchase.memo ? (
                        <span className={styles.memoText}>{purchase.memo}</span>
                      ) : (
                        <span className={styles.empty}>Empty</span>
                      )}
                    </td>
                    <td>
                      <button className={styles.editButton} onClick={() => handleEdit(purchase)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPurchases.length === 0 && (
            <div className={styles.emptyState}>
              <p>No transactions found matching the filter.</p>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <button
                className={styles.pageButton}
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedPurchase && (
        <TransactionEditModal
          purchase={selectedPurchase}
          onClose={handleCloseModal}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}
