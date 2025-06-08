'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Package, AlertTriangle, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalWarehouses: number;
  totalProducts: number;
  lowStockItems: number;
  recentTransactions: number;
}

export default function WMSDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalWarehouses: 0,
    totalProducts: 0,
    lowStockItems: 0,
    recentTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard statistics
    const fetchStats = async () => {
      try {
        // In a real app, this would fetch from the API
        // For now, using mock data
        setStats({
          totalWarehouses: 3,
          totalProducts: 150,
          lowStockItems: 12,
          recentTransactions: 45,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Warehouse Management System
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your warehouse operations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Warehouses
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWarehouses}</div>
            <p className="text-xs text-muted-foreground">
              Active warehouse locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              SKUs in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">
              Items below threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Transactions today
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/wms/inventory"
                className="block p-4 border rounded-lg hover:bg-gray-50"
              >
                <h3 className="font-medium">View Inventory</h3>
                <p className="text-sm text-gray-500">
                  Check current stock levels across all warehouses
                </p>
              </a>
              <a
                href="/wms/warehouses/new"
                className="block p-4 border rounded-lg hover:bg-gray-50"
              >
                <h3 className="font-medium">Add Warehouse</h3>
                <p className="text-sm text-gray-500">
                  Register a new warehouse location
                </p>
              </a>
              <a
                href="/wms/products/new"
                className="block p-4 border rounded-lg hover:bg-gray-50"
              >
                <h3 className="font-medium">Add Product</h3>
                <p className="text-sm text-gray-500">
                  Create a new product SKU
                </p>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Items that need immediate attention
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center p-2 border-b">
                <div>
                  <p className="font-medium">SKU-001</p>
                  <p className="text-sm text-gray-500">Widget A</p>
                </div>
                <span className="text-red-600 font-medium">25 units</span>
              </div>
              <div className="flex justify-between items-center p-2 border-b">
                <div>
                  <p className="font-medium">SKU-045</p>
                  <p className="text-sm text-gray-500">Component B</p>
                </div>
                <span className="text-red-600 font-medium">50 units</span>
              </div>
              <div className="flex justify-between items-center p-2">
                <div>
                  <p className="font-medium">SKU-112</p>
                  <p className="text-sm text-gray-500">Product C</p>
                </div>
                <span className="text-orange-600 font-medium">75 units</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}