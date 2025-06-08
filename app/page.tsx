import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Ecom OS</h1>
      <p className="mt-4 text-xl">E-commerce Operating System</p>
      
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/wms"
          className="group block p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-blue-600 transition-colors">
            WMS
          </h2>
          <p className="text-gray-600">
            Warehouse Management System
          </p>
        </Link>
        
        <Link
          href="/bookkeeping"
          className="group block p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-blue-600 transition-colors">
            Bookkeeping
          </h2>
          <p className="text-gray-600">
            Xero Transaction Management
          </p>
        </Link>
      </div>
    </main>
  )
}