'use client';

import React from 'react';

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
  align?: 'left' | 'center' | 'right';
}

interface FinancialTableProps {
  data: any[];
  columns: Column[];
  className?: string;
}

export default function FinancialTable({ data, columns, className = '' }: FinancialTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  column.align === 'right' 
                    ? 'text-right' 
                    : column.align === 'center' 
                    ? 'text-center' 
                    : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {columns.map((column) => {
                const value = row[column.key];
                const formattedValue = column.format ? column.format(value) : value;
                
                return (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      column.align === 'right' 
                        ? 'text-right' 
                        : column.align === 'center' 
                        ? 'text-center' 
                        : 'text-left'
                    } ${
                      // Color coding for financial values
                      typeof value === 'number' && column.key.includes('netIncome')
                        ? value < 0 
                          ? 'text-red-600 font-medium' 
                          : 'text-green-600 font-medium'
                        : typeof value === 'number' && column.key.includes('cash')
                        ? value < 0
                          ? 'text-red-600 font-medium'
                          : 'text-gray-900'
                        : 'text-gray-900'
                    }`}
                  >
                    {formattedValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {/* Table Footer with Totals where applicable */}
        {columns.some(col => col.key.includes('Revenue') || col.key.includes('Income') || col.key.includes('Profit')) && (
          <tfoot className="bg-gray-100">
            <tr>
              {columns.map((column, index) => {
                if (index === 0) {
                  return (
                    <td key={column.key} className="px-6 py-4 font-medium text-gray-900">
                      Total
                    </td>
                  );
                }
                
                const isNumericColumn = column.key.includes('Revenue') || 
                                       column.key.includes('Income') || 
                                       column.key.includes('Profit') ||
                                       column.key.includes('Cogs') ||
                                       column.key.includes('Opex');
                
                if (isNumericColumn && typeof data[0][column.key] === 'number') {
                  const total = data.reduce((sum, row) => sum + (row[column.key] || 0), 0);
                  return (
                    <td key={column.key} className="px-6 py-4 text-right font-medium text-gray-900">
                      {column.format ? column.format(total) : total}
                    </td>
                  );
                }
                
                return <td key={column.key} className="px-6 py-4"></td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}