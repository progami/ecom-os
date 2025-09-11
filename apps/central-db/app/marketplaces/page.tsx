'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function MarketplacesPage() {
  // This would come from your database
  const marketplaces = []

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Marketplaces</h1>
            <p className="text-muted-foreground">Manage your sales channels</p>
          </div>
        </div>
        <Button onClick={() => alert('Add Marketplace functionality coming soon!')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Marketplace
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Marketplaces</CardTitle>
          <CardDescription>
            {marketplaces.length} marketplaces connected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commission Rate</TableHead>
                <TableHead>Total Orders</TableHead>
                <TableHead>Total Revenue</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketplaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No marketplaces connected. Add your first marketplace to start selling.
                  </TableCell>
                </TableRow>
              ) : (
                marketplaces.map((marketplace: any) => (
                  <TableRow key={marketplace.id}>
                    <TableCell className="font-medium">{marketplace.name}</TableCell>
                    <TableCell>{marketplace.status}</TableCell>
                    <TableCell>{marketplace.commissionRate}%</TableCell>
                    <TableCell>{marketplace.totalOrders}</TableCell>
                    <TableCell>${marketplace.totalRevenue}</TableCell>
                    <TableCell>
                      {marketplace.lastSync
                        ? new Date(marketplace.lastSync).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>{new Date(marketplace.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(marketplace.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}