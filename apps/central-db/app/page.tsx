import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Package, ShoppingCart, Warehouse, DollarSign, BarChart3, Key } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      title: 'Products',
      description: 'Manage your product catalog across all marketplaces',
      icon: Package,
      href: '/products',
    },
    {
      title: 'Inventory',
      description: 'Track inventory levels across warehouses',
      icon: Warehouse,
      href: '/inventory',
    },
    {
      title: 'Orders',
      description: 'Centralized order management for all channels',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      title: 'Marketplaces',
      description: 'Configure and sync marketplace integrations',
      icon: Database,
      href: '/marketplaces',
    },
    {
      title: 'Finance',
      description: 'View transactions and financial reports',
      icon: DollarSign,
      href: '/finance',
    },
    {
      title: 'Analytics',
      description: 'Business intelligence and reporting',
      icon: BarChart3,
      href: '/analytics',
    },
    {
      title: 'Secrets',
      description: 'Manage API keys and credentials',
      icon: Key,
      href: '/secrets',
    },
  ]

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text">
          CentralDB
        </h1>
        <p className="text-muted-foreground">Centralized database for your ecommerce ecosystem</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link key={feature.title} href={feature.href}>
              <Card className="hover:scale-105 transition-transform cursor-pointer bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Icon className="h-8 w-8 text-purple-400" />
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}