'use client'

import { useState } from 'react'
// import { signIn } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { 
 Package2, 
 Sparkles, 
 ArrowRight, 
 CheckCircle2, 
 BarChart3, 
 Truck, 
 FileText,
 Shield,
 Zap,
 Users
} from '@/lib/lucide-icons'
import { portalUrl, redirectToPortal } from '@/lib/portal'

export default function LandingPage() {
 const [isLoading, setIsLoading] = useState(false)

 const handleTryDemo = async () => {
 setIsLoading(true)
 
 try {
 // Always try to set up demo environment first (it will check internally if data already exists)
 const setupResponse = await fetch('/api/demo/setup', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 })

 if (!setupResponse.ok) {
 const errorData = await setupResponse.json()
 throw new Error(errorData.error || 'Failed to set up demo environment')
 }

 // Wait a moment for the database transaction to complete
 await new Promise(resolve => setTimeout(resolve, 1000))

 // Redirect to portalAuth login; after login, return to Dashboard
 redirectToPortal('/login', `${window.location.origin}/dashboard`)
 } catch (_error) {
 // console.error('Error setting up demo:', error)
 toast.error(_error instanceof Error ? _error.message : 'Failed to set up demo')
 } finally {
 setIsLoading(false)
 }
 }

 const features = [
 {
 icon: <BarChart3 className="h-6 w-6" />,
 title: 'Real-time Analytics',
 description: 'Track inventory levels, costs, and performance with interactive dashboards'
 },
 {
 icon: <Truck className="h-6 w-6" />,
 title: 'Inventory Management',
 description: 'Manage SKUs, track movements, and optimize warehouse operations'
 },
 {
 icon: <FileText className="h-6 w-6" />,
 title: 'Automated Billing',
 description: 'Generate invoices, track payments, and manage customer accounts'
 },
 {
 icon: <Shield className="h-6 w-6" />,
 title: 'Secure & Reliable',
 description: 'Enterprise-grade security with role-based access control'
 },
 {
 icon: <Zap className="h-6 w-6" />,
 title: 'Fast & Efficient',
 description: 'Optimized for speed with real-time updates and notifications'
 },
 {
 icon: <Users className="h-6 w-6" />,
 title: 'Multi-user Support',
 description: 'Collaborate with your team with different access levels'
 }
 ]

 return (
 <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white ">
 {/* Hero Section */}
 <div className="relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-brand-teal-50 " />
 
 <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
 <div className="flex justify-center mb-8">
 <div className="flex items-center gap-3 px-4 py-2 bg-cyan-100 rounded-full">
 <Sparkles className="h-5 w-5 text-cyan-600 " />
 <span className="text-sm font-medium text-cyan-700 ">
 Try it free with demo data
 </span>
 </div>
 </div>
 
 <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight">
 Modern Warehouse
 <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-brand-teal-600 pb-2">
 Management System
 </span>
 </h1>
 
 <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto">
 Streamline your warehouse operations with our comprehensive inventory tracking, 
 automated billing, and real-time analytics platform.
 </p>
 
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={handleTryDemo}
 disabled={isLoading}
 className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-cyan-600 to-brand-teal-600 rounded-lg hover:from-cyan-700 hover:to-brand-teal-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
 >
 {isLoading ? (
 <>
 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 <span>Setting up demo...</span>
 </>
 ) : (
 <>
 <Sparkles className="h-5 w-5" />
 <span>Try Demo</span>
 <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
 </>
 )}
 </button>
 
 <a
 href={portalUrl('/login').toString()}
 onClick={(e) => {
 e.preventDefault()
 redirectToPortal('/login', `${window.location.origin}/dashboard`)
 }}
 className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
 >
 <Package2 className="h-5 w-5" />
 <span>Sign In</span>
 </a>
 </div>
 
 <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-600 ">
 <CheckCircle2 className="h-4 w-4 text-green-500" />
 <span>No credit card required • Instant access • Real sample data</span>
 </div>
 </div>
 </div>

 {/* Features Section */}
 <div className="py-20 px-4 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-7xl">
 <div className="text-center mb-16">
 <h2 className="text-3xl font-bold text-slate-900 mb-4">
 Everything you need to manage your warehouse
 </h2>
 <p className="text-lg text-slate-600 ">
 Powerful features designed for modern 3PL operations
 </p>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
 {features.map((feature, index) => (
 <div 
 key={index}
 className="bg-white rounded-xl p-6 shadow-soft hover:shadow-lg transition-shadow"
 >
 <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-4 text-cyan-600 ">
 {feature.icon}
 </div>
 <h3 className="text-xl font-semibold text-slate-900 mb-2">
 {feature.title}
 </h3>
 <p className="text-slate-600 ">
 {feature.description}
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* CTA Section */}
 <div className="bg-gradient-to-r from-cyan-600 to-brand-teal-600 py-16 px-4 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-4xl text-center">
 <h2 className="text-3xl font-bold text-white mb-4">
 Ready to transform your warehouse operations?
 </h2>
 <p className="text-xl text-cyan-100 mb-8">
 Try the demo now and see how WMS can streamline your business
 </p>
 <button
 onClick={handleTryDemo}
 disabled={isLoading}
 className="inline-flex items-center gap-2 px-8 py-4 text-lg font-medium text-cyan-600 bg-white rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isLoading ? (
 <>
 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 <span>Setting up demo...</span>
 </>
 ) : (
 <>
 <span>Start Your Free Demo</span>
 <ArrowRight className="h-5 w-5" />
 </>
 )}
 </button>
 </div>
 </div>

 {/* Footer */}
 <footer className="bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 ">
 <div className="mx-auto max-w-7xl text-center">
 <div className="flex items-center justify-center gap-2 mb-4">
 <Package2 className="h-8 w-8 text-cyan-600 " />
 <span className="text-2xl font-bold text-slate-900 ">WMS</span>
 </div>
 <p className="text-slate-600 ">
 Modern warehouse management for the digital age
 </p>
 </div>
 </footer>
 </div>
 )
}
