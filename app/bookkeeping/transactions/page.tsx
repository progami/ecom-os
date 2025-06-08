'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Check, X } from 'lucide-react';

interface XeroTransaction {
  id: string;
  date: string;
  description: string;
  payee: string;
  reference: string;
  amount: number;
  suggestedAccountCode?: string;
  suggestedTaxType?: string;
  matchedRule?: string;
  isReconciled: boolean;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<XeroTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call to fetch Xero transactions
      // const response = await fetch('/api/v1/bookkeeping/transactions');
      // const data = await response.json();
      
      // Mock data for now
      const mockTransactions: XeroTransaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          description: 'Office Supplies from Staples',
          payee: 'Staples Inc',
          reference: 'INV-2024-001',
          amount: 156.75,
          suggestedAccountCode: '400',
          suggestedTaxType: 'INPUT2',
          matchedRule: 'Office Supplies Rule',
          isReconciled: false
        },
        {
          id: '2',
          date: '2024-01-16',
          description: 'Monthly Software Subscription',
          payee: 'Adobe Systems',
          reference: 'SUB-2024-01',
          amount: 52.99,
          suggestedAccountCode: '469',
          suggestedTaxType: 'NONE',
          matchedRule: 'Software Subscriptions Rule',
          isReconciled: false
        },
        {
          id: '3',
          date: '2024-01-17',
          description: 'Client Payment - Project ABC',
          payee: 'ABC Corporation',
          reference: 'PAY-2024-001',
          amount: -5000.00,
          isReconciled: true
        }
      ];
      
      setTransactions(mockTransactions);
    } catch (err) {
      setError('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = (transactionId: string) => {
    // TODO: Implement reconciliation
    console.log('Reconciling transaction:', transactionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Xero Transactions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Review and reconcile transactions with suggested categorizations
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {transaction.description}
                      </p>
                      <div className="ml-2 flex-shrink-0">
                        <p className={`text-sm font-semibold ${
                          transaction.amount < 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          ${Math.abs(transaction.amount).toFixed(2)}
                          {transaction.amount < 0 && ' (Income)'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex sm:space-x-4">
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.payee}
                        </p>
                        {transaction.reference && (
                          <p className="text-sm text-gray-500">
                            Ref: {transaction.reference}
                          </p>
                        )}
                      </div>
                    </div>
                    {transaction.matchedRule && !transaction.isReconciled && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Suggested by rule:</span> {transaction.matchedRule}
                        </p>
                        <div className="mt-1 flex space-x-4">
                          <p className="text-sm text-blue-700">
                            Account: <span className="font-mono">{transaction.suggestedAccountCode}</span>
                          </p>
                          <p className="text-sm text-blue-700">
                            Tax: <span className="font-mono">{transaction.suggestedTaxType}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {transaction.isReconciled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check className="mr-1 h-3 w-3" />
                        Reconciled
                      </span>
                    ) : (
                      <button
                        onClick={() => handleReconcile(transaction.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Reconcile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}