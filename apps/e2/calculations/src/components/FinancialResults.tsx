'use client';

import React, { useState } from 'react';
import { FinancialStatements, EnhancedFinancialStatements } from '@/types/financial';
import FinancialTable from './FinancialTable';
import ChartComponent from './ChartComponent';
import { formatDateShort } from '@/lib/utils/dateFormatters';

interface FinancialResultsProps {
  data: FinancialStatements | EnhancedFinancialStatements | null;
}

type ViewType = 'monthly' | 'yearly' | 'charts' | 'ratios';

export default function FinancialResults({ data }: FinancialResultsProps) {
  const [activeView, setActiveView] = useState<ViewType>('yearly');

  if (!data) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <p className="text-gray-500 text-center">No financial data to display. Please run calculations first.</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const yearlyColumns = [
    { key: 'year', label: 'Year', format: (v: number) => `Year ${v}` },
    { key: 'totalRevenue', label: 'Total Revenue', format: formatCurrency },
    { key: 'grossProfit', label: 'Gross Profit', format: formatCurrency },
    { key: 'grossMargin', label: 'Gross Margin', format: formatPercent },
    { key: 'netIncome', label: 'Net Income', format: formatCurrency },
    { key: 'netMargin', label: 'Net Margin', format: formatPercent },
    { key: 'endingCash', label: 'Cash Balance', format: formatCurrency },
  ];

  const monthlyColumns = [
    { key: 'date', label: 'Date', format: (v: string) => formatDateShort(v) },
    { key: 'totalRevenue', label: 'Revenue', format: formatCurrency },
    { key: 'totalCogs', label: 'COGS', format: formatCurrency },
    { key: 'grossProfit', label: 'Gross Profit', format: formatCurrency },
    { key: 'totalOpex', label: 'OpEx', format: formatCurrency },
    { key: 'netIncome', label: 'Net Income', format: formatCurrency },
    { key: 'cash', label: 'Cash', format: formatCurrency },
  ];

  const ratioColumns = [
    { key: 'year', label: 'Year', format: (v: number) => `Year ${v}` },
    { key: 'currentRatio', label: 'Current Ratio', format: (v: number) => v.toFixed(2) },
    { key: 'quickRatio', label: 'Quick Ratio', format: (v: number) => v.toFixed(2) },
    { key: 'debtToEquity', label: 'Debt/Equity', format: (v: number) => v.toFixed(2) },
    { key: 'returnOnAssets', label: 'ROA', format: formatPercent },
    { key: 'returnOnEquity', label: 'ROE', format: formatPercent },
  ];

  const chartData = {
    revenue: {
      labels: data.yearlyData?.map((d: any) => `Year ${d.year}`) || [],
      datasets: [{
        label: 'Total Revenue',
        data: data.yearlyData?.map((d: any) => d.totalRevenue) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
      }]
    },
    profitability: {
      labels: data.yearlyData?.map((d: any) => `Year ${d.year}`) || [],
      datasets: [
        {
          label: 'Gross Profit',
          data: data.yearlyData?.map((d: any) => d.grossProfit) || [],
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
        },
        {
          label: 'Net Income',
          data: data.yearlyData?.map((d: any) => d.netIncome) || [],
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 2,
        }
      ]
    },
    cashFlow: {
      labels: data.monthlyData?.map((d: any) => formatDateShort(d.date)) || [],
      datasets: [{
        label: 'Cash Balance',
        data: data.monthlyData?.map((d: any) => d.cash) || [],
        backgroundColor: 'rgba(251, 146, 60, 0.5)',
        borderColor: 'rgb(251, 146, 60)',
        borderWidth: 2,
      }]
    },
    margins: {
      labels: data.yearlyData?.map((d: any) => `Year ${d.year}`) || [],
      datasets: [
        {
          label: 'Gross Margin %',
          data: data.yearlyData?.map((d: any) => d.grossMargin * 100) || [],
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
        },
        {
          label: 'Net Margin %',
          data: data.yearlyData?.map((d: any) => d.netMargin * 100) || [],
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
        }
      ]
    }
  };

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveView('yearly')}
            className={`pb-2 px-4 font-medium text-sm ${
              activeView === 'yearly' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Yearly Summary
          </button>
          <button
            onClick={() => setActiveView('monthly')}
            className={`pb-2 px-4 font-medium text-sm ${
              activeView === 'monthly' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly Details
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`pb-2 px-4 font-medium text-sm ${
              activeView === 'charts' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Visual Charts
          </button>
          <button
            onClick={() => setActiveView('ratios')}
            className={`pb-2 px-4 font-medium text-sm ${
              activeView === 'ratios' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Financial Ratios
          </button>
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === 'yearly' && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4">5-Year Financial Summary</h3>
          <FinancialTable
            data={data.yearlyData}
            columns={yearlyColumns}
          />
        </div>
      )}

      {activeView === 'monthly' && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4">Monthly Cash Flow</h3>
          <div className="overflow-x-auto">
            <FinancialTable
              data={data.monthlyData}
              columns={monthlyColumns}
            />
          </div>
        </div>
      )}

      {activeView === 'charts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Revenue Growth</h3>
              <ChartComponent
                type="bar"
                data={chartData.revenue}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatCurrency(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Profitability Trends</h3>
              <ChartComponent
                type="bar"
                data={chartData.profitability}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatCurrency(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Cash Flow Evolution</h3>
              <ChartComponent
                type="line"
                data={chartData.cashFlow}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatCurrency(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Margin Analysis</h3>
              <ChartComponent
                type="line"
                data={chartData.margins}
                options={{
                  responsive: true,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return `${value}%`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeView === 'ratios' && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4">Financial Ratios Analysis</h3>
          <FinancialTable
            data={data.yearlyData}
            columns={ratioColumns}
          />
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4 text-gray-900">Key Performance Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Revenue (5 Years)</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(data.yearlyData?.reduce((sum: number, year: any) => sum + year.totalRevenue, 0) || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Net Income (5 Years)</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(data.yearlyData?.reduce((sum: number, year: any) => sum + year.netIncome, 0) || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Final Cash Balance</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.yearlyData?.[data.yearlyData.length - 1]?.endingCash || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Net Margin</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatPercent(data.yearlyData?.reduce((sum: number, year: any) => sum + year.netMargin, 0) / (data.yearlyData?.length || 1) || 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}