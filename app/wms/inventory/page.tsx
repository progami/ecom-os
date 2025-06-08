'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, AlertTriangle, Search } from 'lucide-react';

interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  lastUpdated: string;
  batchLot: string;
  currentUnits: number;
  currentCartons: number;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedWarehouse !== 'all') {
          params.append('warehouseId', selectedWarehouse);
        }
        if (showLowStock) {
          params.append('lowStock', 'true');
        }

        const response = await fetch(`/api/v1/wms/inventory?${params}`);
        if (response.ok) {
          const data = await response.json();
          setInventory(data.items);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [selectedWarehouse, showLowStock]);

  const filteredInventory = inventory.filter(
    (item) =>
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockThreshold = 100;

  if (loading) {
    return <div>Loading inventory...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track stock levels across all warehouses
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by SKU or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select
                value={selectedWarehouse}
                onValueChange={setSelectedWarehouse}
              >
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  <SelectItem value="wh1">Main Warehouse</SelectItem>
                  <SelectItem value="wh2">Secondary Warehouse</SelectItem>
                  <SelectItem value="wh3">Distribution Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant={showLowStock ? 'default' : 'outline'}
                onClick={() => setShowLowStock(!showLowStock)}
                className="w-full"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock Only
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredInventory.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No inventory items found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or add new inventory.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU / Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch/Lot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.sku}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.productName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.warehouseName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.warehouseCode}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.batchLot || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.currentUnits} {item.unit}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.currentCartons} cartons
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.currentUnits < lowStockThreshold ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.lastUpdated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}