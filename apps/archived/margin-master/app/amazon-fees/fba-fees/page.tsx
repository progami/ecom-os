'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FulfillmentFeesTable,
  StorageFeesTable,
  ReferralFeesTable,
  OptionalServicesTable,
  SurchargesTable,
} from '@/components/fee-tables'

export default function FBAFeesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Amazon FBA Fee Tables</h1>
            <p className="text-muted-foreground">
              View and manage Amazon FBA fee structures for accurate margin calculations
            </p>
          </div>
        </div>

        <Tabs defaultValue="fulfillment" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="referral">Referral</TabsTrigger>
            <TabsTrigger value="optional">Optional Services</TabsTrigger>
            <TabsTrigger value="surcharges">Surcharges</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fulfillment" className="space-y-4">
            <FulfillmentFeesTable />
          </TabsContent>
          
          <TabsContent value="storage" className="space-y-4">
            <StorageFeesTable />
          </TabsContent>
          
          <TabsContent value="referral" className="space-y-4">
            <ReferralFeesTable />
          </TabsContent>
          
          <TabsContent value="optional" className="space-y-4">
            <OptionalServicesTable />
          </TabsContent>
          
          <TabsContent value="surcharges" className="space-y-4">
            <SurchargesTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}