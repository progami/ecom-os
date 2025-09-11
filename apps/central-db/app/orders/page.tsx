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

export default function OrdersPage() {
  // This would come from your database
  const orders = []

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
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">Manage your marketplace orders</p>
          </div>
        </div>
        <Button onClick={() => alert('Add Order functionality coming soon!')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            {orders.length} orders across all marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Ship By Date</TableHead>
                <TableHead>Items Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No orders found. Orders will appear here when you receive them.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.marketplace?.name}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>{order.totalAmount}</TableCell>
                    <TableCell>{order.currency}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(order.shipByDate).toLocaleDateString()}</TableCell>
                    <TableCell>{order.itemsCount}</TableCell>
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