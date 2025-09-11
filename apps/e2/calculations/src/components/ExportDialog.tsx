'use client';

import React, { useState } from 'react';
import { COMPANY_CONFIG } from '@/config/environment.client';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (exportConfig: ExportConfig) => void;
}

interface ExportConfig {
  exportType: string;
  format: string;
  period: {
    startDate: string;
    endDate: string;
  };
  options: {
    includeDetails?: boolean;
    includeTransactionDetail?: boolean;
    companyInfo?: {
      name: string;
      address?: string;
      phone?: string;
      email?: string;
      taxId?: string;
    };
  };
}

const exportTypes = [
  { value: 'financial-package', label: 'Complete Financial Package', formats: ['excel'] },
  { value: 'income-statement', label: 'Income Statement', formats: ['pdf', 'excel'] },
  { value: 'balance-sheet', label: 'Balance Sheet', formats: ['pdf', 'excel'] },
  { value: 'cash-flow', label: 'Cash Flow Statement', formats: ['pdf', 'excel'] },
  { value: 'general-ledger', label: 'General Ledger', formats: ['pdf', 'excel', 'csv'] },
  { value: 'inventory', label: 'Inventory Report', formats: ['pdf', 'excel'] },
  { value: 'trial-balance', label: 'Trial Balance', formats: ['pdf', 'excel'] },
  { value: 'year-end', label: 'Year-End Package', formats: ['excel'] },
  { value: 'audit', label: 'Audit Package', formats: ['excel'] }
];

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [exportType, setExportType] = useState('financial-package');
  const [format, setFormat] = useState('excel');
  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
  const [endDate, setEndDate] = useState(new Date().getFullYear() + '-12-31');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeTransactionDetail, setIncludeTransactionDetail] = useState(true);
  const [companyName, setCompanyName] = useState(COMPANY_CONFIG.name);
  const [companyAddress, setCompanyAddress] = useState(COMPANY_CONFIG.address || '');
  const [companyPhone, setCompanyPhone] = useState(COMPANY_CONFIG.phone || '');
  const [companyEmail, setCompanyEmail] = useState(COMPANY_CONFIG.email || '');
  const [companyTaxId, setCompanyTaxId] = useState('');

  if (!isOpen) return null;

  const selectedExportType = exportTypes.find(et => et.value === exportType);
  const availableFormats = selectedExportType?.formats || ['pdf'];

  const handleExport = () => {
    const exportConfig: ExportConfig = {
      exportType,
      format,
      period: { startDate, endDate },
      options: {
        includeDetails,
        includeTransactionDetail,
        companyInfo: {
          name: companyName,
          address: companyAddress || undefined,
          phone: companyPhone || undefined,
          email: companyEmail || undefined,
          taxId: companyTaxId || undefined
        }
      }
    };
    
    onExport(exportConfig);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Export Financial Data</h2>
          <p className="mt-1 text-sm text-gray-600">
            Select the type of report and format for export
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Type
            </label>
            <select
              value={exportType}
              onChange={(e) => {
                setExportType(e.target.value);
                const newType = exportTypes.find(et => et.value === e.target.value);
                if (newType && !newType.formats.includes(format)) {
                  setFormat(newType.formats[0]);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {exportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="flex gap-4">
              {availableFormats.map((fmt) => (
                <label key={fmt} className="flex items-center">
                  <input
                    type="radio"
                    value={fmt}
                    checked={format === fmt}
                    onChange={(e) => setFormat(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {fmt.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Export Options</h3>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600">Include detailed breakdowns</span>
            </label>
            {exportType === 'audit' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeTransactionDetail}
                  onChange={(e) => setIncludeTransactionDetail(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">Include transaction-level detail</span>
              </label>
            )}
          </div>

          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Company Information</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Address</label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="123 Main St, Suite 100, City, State 12345"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="finance@company.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tax ID</label>
              <input
                type="text"
                value={companyTaxId}
                onChange={(e) => setCompanyTaxId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="XX-XXXXXXX"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!companyName}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}