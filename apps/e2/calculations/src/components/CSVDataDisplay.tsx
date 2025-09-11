// src/components/CSVDataDisplay.tsx

'use client';

import React from 'react';
import { useCSVData } from '@/lib/hooks/useCSVData';

export const CSVDataDisplay: React.FC = () => {
  const { csvData, defaultAssumptions, productMargins, loading, error, refresh } = useCSVData();
  
  if (loading) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-gray-600">Loading CSV data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-100 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <button 
          onClick={refresh}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Product Margins Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Product Margins (from CSV)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retail Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total COGS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Profit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Margin %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productMargins?.map((margin, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {margin.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${margin.retailPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(margin.totalCogs || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(margin.retailPrice - (margin.totalCogs || 0)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {((margin.grossMarginPercentage || 0)).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Yearly Figures Section */}
      {csvData?.yearlyFigures && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Yearly Revenue Summary (from CSV)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {csvData.yearlyFigures.map((year: any, index: number) => (
              <div key={index} className="bg-gray-50 p-4 rounded">
                <h4 className="font-semibold text-gray-700">Year {year.year}</h4>
                <p className="text-sm text-gray-600 mt-2">
                  Revenue: ${year.totalRevenue?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Gross Margin: {((year.grossMargin || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">
                  Net Margin: {((year.netMargin || 0) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Investment Breakdown Section */}
      {csvData?.investmentBreakdown && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Investment Breakdown (from CSV)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Sources of Funds</h4>
              <ul className="space-y-1">
                {(csvData.investmentBreakdown as any).sources?.map((source: any, index: number) => (
                  <li key={index} className="text-sm text-gray-600">
                    {source.name}: ${source.amount?.toLocaleString()} ({source.percentage}%)
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-semibold">
                Total: ${(csvData.investmentBreakdown as any).totalInvestment?.toLocaleString()}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Use of Funds</h4>
              <ul className="space-y-1">
                {(csvData.investmentBreakdown as any).uses?.map((use: any, index: number) => (
                  <li key={index} className="text-sm text-gray-600">
                    {use.name}: ${use.amount?.toLocaleString()} ({use.percentage}%)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Data Validation Status */}
      {(csvData as any)?._validation && (
        <div className={`p-4 rounded-lg ${(csvData as any)._validation.isValid ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <h4 className="font-semibold mb-2">Data Validation</h4>
          <p className="text-sm">
            Status: {(csvData as any)._validation.isValid ? 'Valid' : 'Has Issues'}
          </p>
          {(csvData as any)._validation.errors?.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-semibold text-red-600">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-600">
                {(csvData as any)._validation.errors.map((error: any, index: number) => (
                  <li key={index}>{error.field}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}
          {(csvData as any)._validation.warnings?.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-semibold text-yellow-600">Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-600">
                {(csvData as any)._validation.warnings.map((warning: any, index: number) => (
                  <li key={index}>{warning.field}: {warning.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <button 
        onClick={refresh}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh Data
      </button>
    </div>
  );
};