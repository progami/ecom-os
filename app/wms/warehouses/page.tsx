'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Building2, MapPin, Phone, Mail } from 'lucide-react';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  _count: {
    inventoryLogs: number;
    products: number;
  };
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/v1/wms/warehouses');
        if (response.ok) {
          const data = await response.json();
          setWarehouses(data);
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouses();
  }, []);

  if (loading) {
    return <div>Loading warehouses...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your warehouse locations
          </p>
        </div>
        <Link href="/wms/warehouses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Warehouse
          </Button>
        </Link>
      </div>

      {warehouses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No warehouses
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new warehouse.
            </p>
            <div className="mt-6">
              <Link href="/wms/warehouses/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Warehouse
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{warehouse.name}</span>
                  <span className="text-sm font-normal text-gray-500">
                    {warehouse.code}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {warehouse.address && (
                    <div className="flex items-start text-sm">
                      <MapPin className="mr-2 h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600">{warehouse.address}</span>
                    </div>
                  )}
                  {warehouse.contactEmail && (
                    <div className="flex items-center text-sm">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        {warehouse.contactEmail}
                      </span>
                    </div>
                  )}
                  {warehouse.contactPhone && (
                    <div className="flex items-center text-sm">
                      <Phone className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        {warehouse.contactPhone}
                      </span>
                    </div>
                  )}
                  <div className="pt-4 mt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Products:</span>
                      <span className="font-medium">
                        {warehouse._count.products}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Transactions:</span>
                      <span className="font-medium">
                        {warehouse._count.inventoryLogs}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}