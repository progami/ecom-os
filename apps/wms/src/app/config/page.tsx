import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Link from 'next/link'
import { 
  Package, 
  Eye, 
  Building, 
  DollarSign, 
  FileText,
  Warehouse,
  ArrowRight
} from '@/lib/lucide-icons'

const configModules = [
  {
    title: 'Products',
    description: 'Manage product master data',
    href: '/config/products',
    icon: Package,
    color: 'bg-cyan-100 text-cyan-700'
  },
  {
    title: 'Batch Attributes',
    description: 'Define batch tracking attributes',
    href: '/config/batch-attributes',
    icon: Eye,
    color: 'bg-brand-teal-100 text-brand-teal-700'
  },
  {
    title: 'Warehouse Configs',
    description: 'Manage warehouses and pricing',
    href: '/config/warehouses',
    icon: Building,
    color: 'bg-green-100 text-green-700'
  },
  {
    title: 'Cost Rates',
    description: 'Set up pricing and rates',
    href: '/config/warehouses?view=rates',
    icon: DollarSign,
    color: 'bg-amber-100 text-amber-700'
  },
  {
    title: 'SKU Warehouse Settings',
    description: 'Control SKU-specific warehouse rules',
    href: '/config/warehouse-configs',
    icon: Warehouse,
    color: 'bg-cyan-100 text-cyan-700'
  },
  {
    title: 'Invoice Templates',
    description: 'Customize invoice formats',
    href: '/config/invoice-templates',
    icon: FileText,
    color: 'bg-red-100 text-red-700'
  }
]

export default function ConfigurationPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">
            Set up master data and system configurations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group relative rounded-xl border p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className={`inline-flex p-2 rounded-lg ${module.color}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{module.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        <div className="border rounded-lg p-6 bg-amber-50">
          <h3 className="font-semibold mb-2">Configuration Tips</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>• Set up <strong>Products (SKUs)</strong> before creating transactions</li>
            <li>• Configure <strong>Cost Rates</strong> for accurate billing</li>
            <li>• Use <strong>Warehouse Configs</strong> for SKU-specific pallet settings</li>
            <li>• Keep <strong>Warehouses</strong> information updated</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}
