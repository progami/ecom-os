import Link from 'next/link'
import { Package2, BookOpen, Database, Search, Users, ArrowRight, Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Static background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1'%3E%3Cpath d='M0 20h40M20 0v40'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative flex items-center justify-center min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="text-center mb-20">
            {/* Animated logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl shadow-2xl flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            
            <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
              Ecom OS
            </h1>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto">
              Your unified platform for e-commerce operations
            </p>
          </div>

          {/* Application Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* WMS Card */}
            <Link
              href="/wms"
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-[1.02]"
            >
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
              
              <div className="relative">
                {/* Icon container */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                    <Package2 className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Content */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
                  Warehouse Management
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Complete inventory control, shipment tracking, and multi-warehouse operations management
                </p>
                
                {/* Action */}
                <div className="flex items-center text-blue-400 font-medium group-hover:text-blue-300">
                  <span>Launch WMS</span>
                  <ArrowRight className="ml-2 w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
            </Link>

            {/* Bookkeeping Card */}
            <Link
              href="/bookkeeping"
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-[1.02]"
            >
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
              
              <div className="relative">
                {/* Icon container */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Content */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors">
                  Bookkeeping
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Automated financial reconciliation and seamless Xero integration for effortless accounting
                </p>
                
                {/* Action */}
                <div className="flex items-center text-emerald-400 font-medium group-hover:text-emerald-300">
                  <span>Launch Bookkeeping</span>
                  <ArrowRight className="ml-2 w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl" />
            </Link>

            {/* CentralDB Card */}
            <Link
              href="/centraldb"
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-[1.02]"
            >
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
              
              <div className="relative">
                {/* Icon container */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Content */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">
                  CentralDB
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Unified database management with table views, analytics, and data visualization
                </p>
                
                {/* Action */}
                <div className="flex items-center text-purple-400 font-medium group-hover:text-purple-300">
                  <span>Launch CentralDB</span>
                  <ArrowRight className="ml-2 w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl" />
            </Link>
          </div>

          {/* Second Row - CaseHunter and HRMS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* CaseHunter Card */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 opacity-75">
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              
              <div className="relative">
                {/* Icon container */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-xl flex items-center justify-center">
                    <Search className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Content */}
                <h2 className="text-2xl font-bold text-white mb-3">
                  CaseHunter
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Advanced case tracking and legal document management system
                </p>
                
                {/* Coming Soon Badge */}
                <div className="inline-flex items-center px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
                  Coming Soon
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
            </div>

            {/* HRMS Card */}
            <Link
              href="/hrms"
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-[1.02]"
            >
              {/* Card glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
              
              <div className="relative">
                {/* Icon container */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Content */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                  HRMS
                </h2>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Manage freelancers, employees, contracts, and payroll in one unified system
                </p>
                
                {/* Action */}
                <div className="flex items-center text-indigo-400 font-medium group-hover:text-indigo-300">
                  <span>Launch HRMS</span>
                  <ArrowRight className="ml-2 w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
            </Link>

            {/* Empty cell for balance */}
            <div></div>
          </div>

          {/* Footer */}
          <div className="text-center mt-20">
            <p className="text-sm text-purple-300/60">
              © 2025 Ecom OS. Built for modern e-commerce.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}