'use client';

import React, { useState, useEffect } from 'react';
import { Assumptions, SupplierPaymentTerm } from '@/types/financial';

interface ProductSalesMix {
  sku: string;
  percentage: number;
  monthlyUnits: number;
}

interface AssumptionsFormProps {
  onSubmit: (assumptions: Assumptions) => void;
  isLoading?: boolean;
}

export default function AssumptionsForm({ onSubmit, isLoading }: AssumptionsFormProps) {
  const [configLoaded, setConfigLoaded] = useState(false);
  const [assumptions, setAssumptions] = useState<Assumptions>({
    // General & Timing
    modelStartDate: '2025-01-01',
    
    // Sales & Revenue
    baseMonthlySalesUnits: 1000,
    annualGrowthRateY1: 0.60,
    annualGrowthRateY2: 0.50,
    annualGrowthRateY3: 0.35,
    annualGrowthRateY4: 0.25,
    annualGrowthRateY5: 0.20,
    
    // Channel Mix
    ecommerceChannelMixY1: 1.00,
    ecommerceChannelMixY2: 0.90,
    ecommerceChannelMixY3: 0.75,
    ecommerceChannelMixY4: 0.60,
    ecommerceChannelMixY5: 0.50,
    
    // Product Sales Mix
    productSalesMix: [
      { sku: 'SKU001', percentage: 0.40, monthlyUnits: 400 },
      { sku: 'SKU002', percentage: 0.35, monthlyUnits: 350 },
      { sku: 'SKU003', percentage: 0.25, monthlyUnits: 250 },
    ],
    
    // Phased Launch
    launchPhaseVelocity: 0.30,
    growthPhaseVelocity: 0.60,
    maturityPhaseVelocity: 1.00,
    
    // Product & COGS
    amazonReferralFeeRate: 0.15, // Default, will be loaded from config
    fulfillmentFeeRate: 0.20,
    refundReturnRate: 0.05,
    
    // Inventory & Supply Chain
    targetMonthsOfSupply: 3,
    leadTimeDays: 45,
    tariffRate: 0.075,
    lclShipmentCost: 3000,
    supplierPaymentTerms: [
      { percentage: 0.30, daysAfterPO: 0 },
      { percentage: 0.70, daysAfterPO: 30 },
    ],
    
    // Operating Expenses
    ownerSalary: 5000,
    managerSalaryFT: 3500,
    associateSalaryPT: 1800,
    ppcAdvertisingRate: 0.10,
    officeRentMonthly: 2000,
    utilitiesMonthly: 200,
    quickbooksMonthly: 70,
    googleWorkspaceMonthly: 12,
    claudeAiMonthly: 20,
    liabilityInsuranceAnnual: 2400,
    accountingFeesMonthly: 250,
    officeSuppliesMonthly: 100,
    grsRegistration: 175,
    
    // Capital & Taxes
    payrollTaxRate: 0.153, // Default, will be loaded from config
    corporateTaxRate: 0.21,
    trademarkCost: 2000,
    trademarkDate: '2025-03-01',
    
    // Initial Investment
    initialInvestment: 300000,
    investmentUseCash: 50000,
    investmentUseInventory: 200000,
    investmentUseSetup: 30000,
    investmentUseMarketing: 20000,
  });

  useEffect(() => {
    // Load config from API
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.businessRules) {
            setAssumptions(prev => ({
              ...prev,
              amazonReferralFeeRate: config.businessRules.amazonReferralRate || 0.15,
              payrollTaxRate: config.businessRules.payrollTaxRate || 0.153,
              tariffRate: config.businessRules.tariffRate || 0.075
            }));
            setConfigLoaded(true);
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    loadConfig();
  }, []);

  const handleInputChange = (field: keyof Assumptions, value: any) => {
    setAssumptions(prev => ({ ...prev, [field]: value }));
  };

  const handleProductMixChange = (index: number, field: keyof ProductSalesMix, value: any) => {
    const newProductMix = [...assumptions.productSalesMix];
    newProductMix[index] = { ...newProductMix[index], [field]: value };
    
    // Update monthly units based on percentage
    if (field === 'percentage') {
      newProductMix[index].monthlyUnits = Math.round(assumptions.baseMonthlySalesUnits * value);
    }
    
    setAssumptions(prev => ({ ...prev, productSalesMix: newProductMix }));
  };

  const handlePaymentTermChange = (index: number, field: keyof SupplierPaymentTerm, value: any) => {
    const newTerms = [...assumptions.supplierPaymentTerms];
    newTerms[index] = { ...newTerms[index], [field]: value };
    setAssumptions(prev => ({ ...prev, supplierPaymentTerms: newTerms }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(assumptions);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-lg">
      {/* General Settings */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">General Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Start Date
            </label>
            <input
              type="date"
              value={assumptions.modelStartDate}
              onChange={(e) => handleInputChange('modelStartDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Monthly Sales Units
            </label>
            <input
              type="number"
              value={assumptions.baseMonthlySalesUnits}
              onChange={(e) => handleInputChange('baseMonthlySalesUnits', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Growth Rates */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Annual Growth Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((year) => (
            <div key={year}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year {year} (%)
              </label>
              <input
                type="number"
                value={assumptions[`annualGrowthRateY${year}` as keyof Assumptions] as number * 100}
                onChange={(e) => handleInputChange(`annualGrowthRateY${year}` as keyof Assumptions, parseFloat(e.target.value) / 100)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                step="0.1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Channel Mix */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">E-commerce Channel Mix</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((year) => (
            <div key={year}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year {year} (%)
              </label>
              <input
                type="number"
                value={assumptions[`ecommerceChannelMixY${year}` as keyof Assumptions] as number * 100}
                onChange={(e) => handleInputChange(`ecommerceChannelMixY${year}` as keyof Assumptions, parseFloat(e.target.value) / 100)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                step="0.1"
                max="100"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Product Mix */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Sales Mix</h2>
        <div className="space-y-4">
          {assumptions.productSalesMix.map((product: any, index: number) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={product.sku}
                  onChange={(e) => handleProductMixChange(index, 'sku', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Percentage (%)
                </label>
                <input
                  type="number"
                  value={product.percentage * 100}
                  onChange={(e) => handleProductMixChange(index, 'percentage', parseFloat(e.target.value) / 100)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Units
                </label>
                <input
                  type="number"
                  value={product.monthlyUnits}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phased Launch Settings */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Year 1 Phased Launch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Launch Phase Velocity (%)
            </label>
            <input
              type="number"
              value={assumptions.launchPhaseVelocity * 100}
              onChange={(e) => handleInputChange('launchPhaseVelocity', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Growth Phase Velocity (%)
            </label>
            <input
              type="number"
              value={assumptions.growthPhaseVelocity * 100}
              onChange={(e) => handleInputChange('growthPhaseVelocity', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maturity Phase Velocity (%)
            </label>
            <input
              type="number"
              value={assumptions.maturityPhaseVelocity * 100}
              onChange={(e) => handleInputChange('maturityPhaseVelocity', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="1"
            />
          </div>
        </div>
      </div>

      {/* Product & COGS */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product & COGS Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amazon Expenses (%)
            </label>
            <input
              type="number"
              value={assumptions.amazonReferralFeeRate * 100}
              onChange={(e) => handleInputChange('amazonReferralFeeRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fulfillment Fee (%)
            </label>
            <input
              type="number"
              value={assumptions.fulfillmentFeeRate * 100}
              onChange={(e) => handleInputChange('fulfillmentFeeRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refund/Return Rate (%)
            </label>
            <input
              type="number"
              value={assumptions.refundReturnRate * 100}
              onChange={(e) => handleInputChange('refundReturnRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Inventory & Supply Chain */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Inventory & Supply Chain</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Months of Supply
            </label>
            <input
              type="number"
              value={assumptions.targetMonthsOfSupply}
              onChange={(e) => handleInputChange('targetMonthsOfSupply', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead Time (Days)
            </label>
            <input
              type="number"
              value={assumptions.leadTimeDays}
              onChange={(e) => handleInputChange('leadTimeDays', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tariff Rate (%)
            </label>
            <input
              type="number"
              value={assumptions.tariffRate * 100}
              onChange={(e) => handleInputChange('tariffRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LCL Shipment Cost
            </label>
            <input
              type="number"
              value={assumptions.lclShipmentCost}
              onChange={(e) => handleInputChange('lclShipmentCost', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Supplier Payment Terms</h3>
        <div className="space-y-3">
          {assumptions.supplierPaymentTerms.map((term: any, index: number) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Percentage (%)
                </label>
                <input
                  type="number"
                  value={term.percentage * 100}
                  onChange={(e) => handlePaymentTermChange(index, 'percentage', parseFloat(e.target.value) / 100)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days After PO
                </label>
                <input
                  type="number"
                  value={term.daysAfterPO}
                  onChange={(e) => handlePaymentTermChange(index, 'daysAfterPO', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  step="1"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operating Expenses */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Operating Expenses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Salary (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.ownerSalary}
              onChange={(e) => handleInputChange('ownerSalary', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manager Salary FT (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.managerSalaryFT}
              onChange={(e) => handleInputChange('managerSalaryFT', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Associate Salary PT (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.associateSalaryPT}
              onChange={(e) => handleInputChange('associateSalaryPT', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PPC Advertising (% of Revenue)
            </label>
            <input
              type="number"
              value={assumptions.ppcAdvertisingRate * 100}
              onChange={(e) => handleInputChange('ppcAdvertisingRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Office Rent (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.officeRentMonthly}
              onChange={(e) => handleInputChange('officeRentMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Utilities (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.utilitiesMonthly}
              onChange={(e) => handleInputChange('utilitiesMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              QuickBooks (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.quickbooksMonthly}
              onChange={(e) => handleInputChange('quickbooksMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Workspace (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.googleWorkspaceMonthly}
              onChange={(e) => handleInputChange('googleWorkspaceMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Claude AI (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.claudeAiMonthly}
              onChange={(e) => handleInputChange('claudeAiMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liability Insurance (Annual)
            </label>
            <input
              type="number"
              value={assumptions.liabilityInsuranceAnnual}
              onChange={(e) => handleInputChange('liabilityInsuranceAnnual', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accounting Fees (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.accountingFeesMonthly}
              onChange={(e) => handleInputChange('accountingFeesMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Office Supplies (Monthly)
            </label>
            <input
              type="number"
              value={assumptions.officeSuppliesMonthly}
              onChange={(e) => handleInputChange('officeSuppliesMonthly', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GRS Registration
            </label>
            <input
              type="number"
              value={assumptions.grsRegistration}
              onChange={(e) => handleInputChange('grsRegistration', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Capital & Taxes */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Capital & Taxes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payroll Tax Rate (%)
            </label>
            <input
              type="number"
              value={assumptions.payrollTaxRate * 100}
              onChange={(e) => handleInputChange('payrollTaxRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Corporate Tax Rate (%)
            </label>
            <input
              type="number"
              value={assumptions.corporateTaxRate * 100}
              onChange={(e) => handleInputChange('corporateTaxRate', parseFloat(e.target.value) / 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trademark Cost
            </label>
            <input
              type="number"
              value={assumptions.trademarkCost}
              onChange={(e) => handleInputChange('trademarkCost', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trademark Date
            </label>
            <input
              type="date"
              value={assumptions.trademarkDate}
              onChange={(e) => handleInputChange('trademarkDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Initial Investment */}
      <div className="border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Initial Investment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Investment
            </label>
            <input
              type="number"
              value={assumptions.initialInvestment}
              onChange={(e) => handleInputChange('initialInvestment', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cash Reserve
            </label>
            <input
              type="number"
              value={assumptions.investmentUseCash}
              onChange={(e) => handleInputChange('investmentUseCash', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Inventory
            </label>
            <input
              type="number"
              value={assumptions.investmentUseInventory}
              onChange={(e) => handleInputChange('investmentUseInventory', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setup Costs
            </label>
            <input
              type="number"
              value={assumptions.investmentUseSetup}
              onChange={(e) => handleInputChange('investmentUseSetup', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Marketing Budget
            </label>
            <input
              type="number"
              value={assumptions.investmentUseMarketing}
              onChange={(e) => handleInputChange('investmentUseMarketing', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className={`px-6 py-3 text-white font-medium rounded-md ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {isLoading ? 'Calculating...' : 'Calculate Financial Projections'}
        </button>
      </div>
    </form>
  );
}