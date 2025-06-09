import Link from 'next/link'
import { Package2, BookOpen, ArrowRight, BarChart3, Shield, Zap, Users } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/10 dark:to-accent/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-2xl">
                <Package2 className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Ecom OS
            </h1>
            <p className="mt-6 text-xl lg:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              The complete operating system for modern e-commerce businesses
            </p>
            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              <Link
                href="/wms"
                className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-lg text-white bg-primary hover:bg-primary/90 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Launch WMS
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/bookkeeping"
                className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-lg text-primary bg-white hover:bg-gray-50 border-2 border-primary transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Launch Bookkeeping
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            Integrated Business Solutions
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Everything you need to run your e-commerce operations efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* WMS Card */}
          <Link
            href="/wms"
            className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative p-8 lg:p-10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Package2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-primary group-hover:translate-x-2 transition-all duration-300" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors">
                Warehouse Management System
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Complete warehouse operations management with real-time inventory tracking, order processing, and multi-location support.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <BarChart3 className="h-4 w-4 mr-2 text-blue-500" />
                  Real-time Analytics
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4 mr-2 text-blue-500" />
                  Multi-user Support
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Shield className="h-4 w-4 mr-2 text-blue-500" />
                  Role-based Access
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Zap className="h-4 w-4 mr-2 text-blue-500" />
                  Fast Performance
                </div>
              </div>
            </div>
          </Link>

          {/* Bookkeeping Card */}
          <Link
            href="/bookkeeping"
            className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative p-8 lg:p-10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-primary group-hover:translate-x-2 transition-all duration-300" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors">
                Xero Bookkeeping Integration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Seamless integration with Xero for automated transaction categorization, reconciliation, and financial reporting.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <BarChart3 className="h-4 w-4 mr-2 text-green-500" />
                  Auto Categorization
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4 mr-2 text-green-500" />
                  Bulk Processing
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Shield className="h-4 w-4 mr-2 text-green-500" />
                  Secure Integration
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Zap className="h-4 w-4 mr-2 text-green-500" />
                  Real-time Sync
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">
              © 2024 Ecom OS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}