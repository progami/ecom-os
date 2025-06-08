'use client';

import { Card } from '@/components/ui/card';
import { FileText, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function BookkeepingDashboard() {
  const stats = [
    {
      title: 'Active Rules',
      value: '0',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Transactions Processed',
      value: '0',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pending Review',
      value: '0',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Categorized Today',
      value: '0',
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bookkeeping Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage your transaction categorization rules and monitor processing status.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/bookkeeping/rules"
            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="font-medium">Manage Rules</p>
              <p className="text-sm text-gray-600">
                View and configure categorization rules
              </p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}