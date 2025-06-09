'use client'

import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WMSDashboardPage() {
  const { data: session } = useSession()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Warehouse Management Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Current stock levels</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">1,234</p>
            <p className="text-sm text-gray-500">Total SKUs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Pending shipments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">56</p>
            <p className="text-sm text-gray-500">To be processed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Warehouses</CardTitle>
            <CardDescription>Active locations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">3</p>
            <p className="text-sm text-gray-500">Operational</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <p className="text-gray-600">Welcome back, {session?.user?.name || 'User'}!</p>
      </div>
    </div>
  )
}