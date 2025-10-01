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

type InventoryRecord = {
  id: string
  product?: {
    sku?: string | null
    title?: string | null
  } | null
  warehouse?: {
    name?: string | null
  } | null
  quantityOnHand?: number | null
  quantityReserved?: number | null
  quantityAvailable?: number | null
  reorderPoint?: number | null
  lastCountedAt?: Date | string | null
  updatedAt?: Date | string | null
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Never'
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleDateString()
}

export default function InventoryPage() {
  // This would come from your database
  const inventory: InventoryRecord[] = []

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
                inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.sku ?? '-'}</TableCell>
                    <TableCell>{item.product?.title ?? '-'}</TableCell>
                    <TableCell>{item.warehouse?.name ?? '-'}</TableCell>
                    <TableCell>{item.quantityOnHand ?? 0}</TableCell>
                    <TableCell>{item.quantityReserved ?? 0}</TableCell>
                    <TableCell>{item.quantityAvailable ?? 0}</TableCell>
                    <TableCell>{item.reorderPoint ?? '-'}</TableCell>
                    <TableCell>{formatDate(item.lastCountedAt)}</TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
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
