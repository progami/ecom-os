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

export default function InventoryPage() {
  // This would come from your database
  const inventory: Array<Record<string, unknown>> = []

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
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">Track inventory across all warehouses</p>
          </div>
        </div>
        <Button onClick={() => alert('Add Inventory functionality coming soon!')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Inventory
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Levels</CardTitle>
          <CardDescription>
            Real-time inventory tracking across all locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product SKU</TableHead>
                <TableHead>Product Title</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>On Hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reorder Point</TableHead>
                <TableHead>Last Counted</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No inventory records found. Add inventory to track stock levels.
                  </TableCell>
                </TableRow>
              ) : (
                inventory.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.sku}</TableCell>
                    <TableCell>{item.product?.title}</TableCell>
                    <TableCell>{item.warehouse?.name}</TableCell>
                    <TableCell>{item.quantityOnHand}</TableCell>
                    <TableCell>{item.quantityReserved}</TableCell>
                    <TableCell>{item.quantityAvailable}</TableCell>
                    <TableCell>{item.reorderPoint || '-'}</TableCell>
                    <TableCell>
                      {item.lastCountedAt
                        ? new Date(item.lastCountedAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
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