'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Upload, X } from '@/lib/lucide-icons';

interface IncompleteTransaction {
  id: string;
  transactionId: string;
  transactionType: string;
  skuCode: string;
  transactionDate: string;
  missingFields: string[];
}

export function IncompleteTransactionsAlert() {
  const [incompleteTransactions, setIncompleteTransactions] = useState<IncompleteTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchIncompleteTransactions();
  }, []);

  const fetchIncompleteTransactions = async () => {
    try {
      const response = await fetch('/api/inventory/incomplete');
      if (response.ok) {
        const data = await response.json();
        setIncompleteTransactions(data);
      }
    } catch (_error) {
      // console.error('Error fetching incomplete transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || incompleteTransactions.length === 0) {
    return null;
  }

  const receiveCount = incompleteTransactions.filter(t => t.transactionType === 'RECEIVE').length;
  const shipCount = incompleteTransactions.filter(t => t.transactionType === 'SHIP').length;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-900">
            Incomplete Transaction Data
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            {incompleteTransactions.length} transactions are missing required information from the Excel import.
          </p>
          
          <div className="mt-2 text-sm text-amber-700">
            <ul className="list-disc list-inside space-y-1">
              {receiveCount > 0 && (
                <li>
                  <strong>{receiveCount} RECEIVE</strong> transactions missing tracking numbers and/or pickup dates
                </li>
              )}
              {shipCount > 0 && (
                <li>
                  <strong>{shipCount} SHIP</strong> transactions missing pickup dates
                </li>
              )}
              <li>All transactions are missing document attachments</li>
            </ul>
          </div>

          <div className="mt-3 flex items-center space-x-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm font-medium text-amber-900 hover:text-amber-800"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <a
              href="/operations/inventory/incomplete"
              className="inline-flex items-center text-sm font-medium text-amber-900 hover:text-amber-800"
            >
              <Upload className="h-4 w-4 mr-1" />
              Complete Transactions
            </a>
          </div>

          {showDetails && (
            <div className="mt-4 bg-white rounded-md p-3 border border-amber-200">
              <h4 className="text-sm font-medium text-slate-900 mb-2">
                Missing Information by Transaction Type:
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong className="text-slate-700">RECEIVE Transactions:</strong>
                  <ul className="mt-1 ml-4 text-slate-600 list-disc">
                    <li>Tracking Number (for tracking shipments)</li>
                    <li>Pickup Date (for delivery scheduling)</li>
                    <li>Supporting Documents (BOL, customs docs, etc.)</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-slate-700">SHIP Transactions:</strong>
                  <ul className="mt-1 ml-4 text-slate-600 list-disc">
                    <li>Pickup Date (for delivery tracking)</li>
                    <li>Shipping Documents (packing lists, invoices, etc.)</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                This data was not available in the Excel import and must be added manually to ensure accurate tracking and billing.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIncompleteTransactions([])}
          className="text-slate-400 hover:text-slate-500"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}