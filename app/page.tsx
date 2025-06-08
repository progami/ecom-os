import Link from 'next/link';
import { Package, Calculator } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-2">Ecom OS</h1>
      <p className="text-xl text-gray-600 mb-12">E-commerce Operating System</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        <Link
          href="/wms"
          className="flex flex-col items-center p-8 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Package className="h-12 w-12 text-blue-600 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Warehouse Management</h2>
          <p className="text-gray-600 text-center">
            Manage inventory, products, and warehouse operations
          </p>
        </Link>
        
        <Link
          href="/bookkeeping"
          className="flex flex-col items-center p-8 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Calculator className="h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Bookkeeping</h2>
          <p className="text-gray-600 text-center">
            Automate transaction categorization with Xero
          </p>
        </Link>
      </div>
    </main>
  )
}