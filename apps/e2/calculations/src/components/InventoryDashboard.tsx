'use client';

import React, { useState } from 'react';
import { InventoryStatus } from '@/types/financial';

interface InventoryDashboardProps {
  inventory: InventoryStatus[];
}

export default function InventoryDashboard({ inventory }: InventoryDashboardProps) {
  const [sortBy, setSortBy] = useState<'sku' | 'value' | 'daysOfSupply'>('value');
  const [filterReorder, setFilterReorder] = useState(false);

  // Calculate totals
  const totalValue = inventory.reduce((sum, item) => sum + item.totalValue, 0);
  const totalUnits = inventory.reduce((sum, item) => sum + item.unitsOnHand, 0);
  const itemsNeedingReorder = inventory.filter(item => item.needsReorder).length;
  const unitsInTransit = inventory.reduce((sum, item) => sum + item.unitsInTransit, 0);

  // Sort and filter inventory
  let displayInventory = [...inventory];
  
  if (filterReorder) {
    displayInventory = displayInventory.filter(item => item.needsReorder);
  }
  
  displayInventory.sort((a, b) => {
    switch (sortBy) {
      case 'sku':
        return a.sku.localeCompare(b.sku);
      case 'value':
        return b.totalValue - a.totalValue;
      case 'daysOfSupply':
        return a.daysOfSupply - b.daysOfSupply;
      default:
        return 0;
    }
  });

  // Get status color
  const getStatusColor = (item: InventoryStatus) => {
    if (item.needsReorder) return 'red';
    if (item.daysOfSupply < 45) return 'yellow';
    return 'green';
  };

  const getStatusText = (item: InventoryStatus) => {
    if (item.needsReorder) return 'Reorder Now';
    if (item.daysOfSupply < 45) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${totalValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Units on Hand</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totalUnits.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Units in Transit</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {unitsInTransit.toLocaleString()}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Items Need Reorder</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {itemsNeedingReorder}
              </p>
            </div>
            <div className={`${itemsNeedingReorder > 0 ? 'bg-red-100' : 'bg-gray-100'} rounded-full p-3`}>
              <svg className={`w-6 h-6 ${itemsNeedingReorder > 0 ? 'text-red-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Turnover Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Turnover Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Average Days of Supply</p>
            <p className="text-xl font-semibold text-gray-900">
              {Math.round(inventory.reduce((sum, item) => sum + item.daysOfSupply, 0) / inventory.length)} days
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Inventory Turnover Rate</p>
            <p className="text-xl font-semibold text-gray-900">
              {(365 / (inventory.reduce((sum, item) => sum + item.daysOfSupply, 0) / inventory.length)).toFixed(1)}x / year
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Working Capital in Inventory</p>
            <p className="text-xl font-semibold text-gray-900">
              ${totalValue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Details</h3>
            
            <div className="flex gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filterReorder}
                  onChange={(e) => setFilterReorder(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show reorder items only</span>
              </label>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="value">Sort by Value</option>
                <option value="sku">Sort by SKU</option>
                <option value="daysOfSupply">Sort by Days of Supply</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU / Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  On Hand
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  In Transit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Supply
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reorder Point
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayInventory.map((item) => {
                const statusColor = getStatusColor(item);
                const statusText = getStatusText(item);
                
                return (
                  <tr key={item.sku} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.sku}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${statusColor === 'green' ? 'bg-green-100 text-green-800' : ''}
                        ${statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${statusColor === 'red' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.unitsOnHand.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.unitsInTransit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${item.unitCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      ${item.totalValue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.daysOfSupply}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.reorderPoint.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reorder Alerts */}
      {itemsNeedingReorder > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-red-900 mb-3">Reorder Required</h4>
          <div className="space-y-2">
            {inventory
              .filter(item => item.needsReorder)
              .map(item => (
                <div key={item.sku} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-900">{item.sku}</span>
                    <span className="text-sm text-red-700 ml-2">- {item.description}</span>
                  </div>
                  <div className="text-sm text-red-700">
                    {item.unitsOnHand} units on hand ({item.daysOfSupply} days supply)
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}