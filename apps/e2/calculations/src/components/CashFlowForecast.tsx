'use client';

import React, { useState } from 'react';
import { CashFlowForecast as CashFlowForecastType } from '@/types/financial';
import ChartComponent from './ChartComponent';

interface CashFlowForecastProps {
  forecast: CashFlowForecastType[];
}

export default function CashFlowForecast({ forecast }: CashFlowForecastProps) {
  const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
  
  // Calculate key metrics
  const currentCash = forecast[0]?.beginningCash || 0;
  const averageBurnRate = forecast.slice(0, 3).reduce((sum, month) => 
    sum + (month.cashOutflows.total - month.cashInflows.total), 0) / 3;
  const runwayMonths = averageBurnRate > 0 ? Math.floor(currentCash / averageBurnRate) : 999;
  const lowestCashPoint = Math.min(...forecast.map(f => f.endingCash));
  const cashBreakEvenMonth = forecast.findIndex(f => f.netCashFlow >= 0);

  // Prepare chart data
  const chartData = {
    labels: forecast.map(f => f.month),
    datasets: [
      {
        label: 'Cash Balance',
        data: forecast.map(f => f.endingCash),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Cash Inflows',
        data: forecast.map(f => f.cashInflows.total),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Cash Outflows',
        data: forecast.map(f => f.cashOutflows.total),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '12-Month Cash Flow Forecast',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: any) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          }
        }
      }
    }
  };

  // Working capital chart data
  const workingCapitalData = {
    labels: ['Current Assets', 'Current Liabilities'],
    datasets: [{
      data: [
        currentCash + (forecast[0]?.cashInflows.revenue || 0) * 0.8, // Cash + estimated AR
        forecast[0]?.cashOutflows.supplierPayments || 0, // Estimated AP
      ],
      backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)'],
    }],
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Cash</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${currentCash.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Burn Rate</p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                ${Math.abs(averageBurnRate).toLocaleString()}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cash Runway</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {runwayMonths > 100 ? '∞' : `${runwayMonths} months`}
              </p>
            </div>
            <div className={`${runwayMonths < 6 ? 'bg-yellow-100' : 'bg-green-100'} rounded-full p-3`}>
              <svg className={`w-6 h-6 ${runwayMonths < 6 ? 'text-yellow-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lowest Cash Point</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${lowestCashPoint.toLocaleString()}
              </p>
            </div>
            <div className={`${lowestCashPoint < 50000 ? 'bg-red-100' : 'bg-gray-100'} rounded-full p-3`}>
              <svg className={`w-6 h-6 ${lowestCashPoint < 50000 ? 'text-red-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Cash Flow Projection</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewType('chart')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                viewType === 'chart' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Chart View
            </button>
            <button
              onClick={() => setViewType('table')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                viewType === 'table' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Chart View */}
        {viewType === 'chart' && (
          <div className="space-y-6">
            <div style={{ height: '400px' }}>
              <ChartComponent
                type="line"
                data={chartData}
                options={chartOptions}
              />
            </div>
            
            {/* Working Capital Trend */}
            <div className="mt-8 pt-8 border-t">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Working Capital Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div style={{ height: '300px' }}>
                  <ChartComponent
                    type="doughnut"
                    data={workingCapitalData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' as const },
                        title: { display: true, text: 'Working Capital Structure' },
                      },
                    }}
                  />
                </div>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700">Working Capital Ratio</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {((currentCash + (forecast[0]?.cashInflows.revenue || 0) * 0.8) / 
                        (forecast[0]?.cashOutflows.supplierPayments || 1)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Target: &gt;1.5</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700">Cash Conversion Cycle</p>
                    <p className="text-xl font-semibold text-gray-900">45 days</p>
                    <p className="text-xs text-gray-500 mt-1">Industry avg: 60 days</p>
                  </div>
                  {cashBreakEvenMonth > 0 && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-700">Cash Flow Positive</p>
                      <p className="text-xl font-semibold text-green-900">
                        Month {cashBreakEvenMonth + 1}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {forecast[cashBreakEvenMonth]?.month}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table View */}
        {viewType === 'table' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beginning Cash
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Inflows
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier Payments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payroll
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operating Exp
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Outflows
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Cash Flow
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ending Cash
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Runway
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecast.map((month, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {month.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${month.beginningCash.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${month.cashInflows.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      ${month.cashInflows.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${month.cashOutflows.supplierPayments.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${month.cashOutflows.payroll.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${month.cashOutflows.operatingExpenses.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                      ${month.cashOutflows.total.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                      month.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${month.netCashFlow.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                      month.endingCash < 50000 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      ${month.endingCash.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      {!month.cashRunway || month.cashRunway > 100 ? '∞' : `${month.cashRunway}m`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash Management Recommendations */}
      {runwayMonths < 12 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-yellow-900 mb-3">
            Cash Management Recommendations
          </h4>
          <ul className="space-y-2 text-sm text-yellow-800">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Consider extending supplier payment terms to improve cash flow
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Accelerate revenue collection with early payment discounts
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Review operating expenses for potential cost reductions
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}