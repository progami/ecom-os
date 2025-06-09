'use client';

import { useState } from 'react';
import { Calendar, FileText, CheckCircle, XCircle } from 'lucide-react';

interface ReconciliationSummary {
  date: string;
  totalTransactions: number;
  reconciled: number;
  pending: number;
  errors: number;
}

export default function ReconciliationPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  // Mock data - replace with actual API calls
  const summaries: ReconciliationSummary[] = [
    {
      date: '2024-01-17',
      totalTransactions: 15,
      reconciled: 12,
      pending: 2,
      errors: 1
    },
    {
      date: '2024-01-16',
      totalTransactions: 23,
      reconciled: 23,
      pending: 0,
      errors: 0
    },
    {
      date: '2024-01-15',
      totalTransactions: 18,
      reconciled: 17,
      pending: 0,
      errors: 1
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reconciliation</h2>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage your transaction reconciliation status
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Reconciliation Status
            </h3>
            <div className="mt-3 sm:mt-0">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="ml-2 text-sm font-medium text-gray-500">
                  Total
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {summaries.reduce((sum, s) => sum + s.totalTransactions, 0)}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="ml-2 text-sm font-medium text-green-700">
                  Reconciled
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-900">
                {summaries.reduce((sum, s) => sum + s.reconciled, 0)}
              </p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-yellow-400" />
                <span className="ml-2 text-sm font-medium text-yellow-700">
                  Pending
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-yellow-900">
                {summaries.reduce((sum, s) => sum + s.pending, 0)}
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-400" />
                <span className="ml-2 text-sm font-medium text-red-700">
                  Errors
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-red-900">
                {summaries.reduce((sum, s) => sum + s.errors, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">
            Daily Summary
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {summaries.map((summary) => (
            <li key={summary.date}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(summary.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {summary.totalTransactions} transactions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-green-600">
                        {summary.reconciled}
                      </p>
                      <p className="text-xs text-gray-500">Reconciled</p>
                    </div>
                    {summary.pending > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-yellow-600">
                          {summary.pending}
                        </p>
                        <p className="text-xs text-gray-500">Pending</p>
                      </div>
                    )}
                    {summary.errors > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-red-600">
                          {summary.errors}
                        </p>
                        <p className="text-xs text-gray-500">Errors</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(summary.reconciled / summary.totalTransactions) * 100}%`
                      }}
                    />
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