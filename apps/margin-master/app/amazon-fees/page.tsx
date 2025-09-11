'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FulfillmentFeesTable,
  StorageFeesTable,
  ReferralFeesTable,
  SippDiscountsTable,
  LowInventoryFeesTable
} from '@/components/fee-tables';
import { Package, Archive, Percent, AlertTriangle, Tag, BarChart3 } from 'lucide-react';
import { FeeTierVisualization } from '@/components/fee-tier-visualization';
import { useEffect } from 'react';

export default function AmazonFeesPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("fulfilment");
  const [fulfillmentFeesData, setFulfillmentFeesData] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'visualization') {
      fetch('/api/amazon-fees/fulfilment-fees')
        .then(res => res.json())
        .then(data => {
          if (data.standardFees) {
            setFulfillmentFeesData(data.standardFees);
          }
        })
        .catch(err => console.error('Failed to fetch fees:', err));
    }
  }, [activeTab]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Country Filter */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Amazon Fee Tables</h1>
            <p className="text-muted-foreground">
              Reference tables for Amazon marketplace fees
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by country:</span>
            <Select value={selectedCountry || "all"} onValueChange={(value) => setSelectedCountry(value === "all" ? null : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="NL">Netherlands</SelectItem>
                <SelectItem value="SE">Sweden</SelectItem>
                <SelectItem value="PL">Poland</SelectItem>
                <SelectItem value="BE">Belgium</SelectItem>
                <SelectItem value="IE">Ireland</SelectItem>
                <SelectItem value="TR">Turkey</SelectItem>
                <SelectItem value="CEP (DE/PL/CZ)">Central Europe (DE/PL/CZ)</SelectItem>
                <SelectItem value="NL/BE">Netherlands/Belgium</SelectItem>
                <SelectItem value="NL/BE/IE">Netherlands/Belgium/Ireland</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fee Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="fulfilment" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Fulfilment
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="referral" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Referral
            </TabsTrigger>
            <TabsTrigger value="sipp" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              SIPP Discounts
            </TabsTrigger>
            <TabsTrigger value="low-inventory" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Inventory
            </TabsTrigger>
            <TabsTrigger value="visualization" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Visualization
            </TabsTrigger>
          </TabsList>

          {/* Fulfilment Fees Tab */}
          <TabsContent value="fulfilment">
            <FulfillmentFeesTable countryFilter={selectedCountry || undefined} />
          </TabsContent>

          {/* Storage Fees Tab */}
          <TabsContent value="storage">
            <StorageFeesTable countryFilter={selectedCountry || undefined} />
          </TabsContent>

          {/* Referral Fees Tab */}
          <TabsContent value="referral">
            <ReferralFeesTable countryFilter={selectedCountry || undefined} />
          </TabsContent>

          {/* SIPP Discounts Tab */}
          <TabsContent value="sipp">
            <SippDiscountsTable countryFilter={selectedCountry || undefined} />
          </TabsContent>

          {/* Low Inventory Fees Tab */}
          <TabsContent value="low-inventory">
            <LowInventoryFeesTable countryFilter={selectedCountry || undefined} />
          </TabsContent>

          {/* Visualization Tab */}
          <TabsContent value="visualization">
            {fulfillmentFeesData.length > 0 && (
              <FeeTierVisualization 
                data={fulfillmentFeesData} 
                selectedCountry={selectedCountry || undefined}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}