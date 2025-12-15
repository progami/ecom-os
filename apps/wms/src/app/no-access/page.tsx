import Link from 'next/link'
import { ShieldX, ArrowLeft, ExternalLink } from '@/lib/lucide-icons'

export default function NoAccessPage() {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || process.env.PORTAL_AUTH_URL || '/'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="mx-auto h-24 w-24 bg-amber-100 rounded-full flex items-center justify-center">
            <ShieldX className="h-12 w-12 text-amber-600" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-slate-900">
            No Access to WMS
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Your account does not have permission to access the Warehouse Management System.
          </p>
        </div>

        <div className="bg-slate-100 rounded-lg p-4 text-left">
          <h2 className="text-sm font-medium text-slate-700 mb-2">What does this mean?</h2>
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>You are signed in but WMS access has not been granted to your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Contact your administrator to request access</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={portalUrl}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Link>
          <a
            href={`mailto:support@targonglobal.com?subject=WMS Access Request`}
            className="inline-flex items-center px-5 py-2.5 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Request Access
          </a>
        </div>

        <p className="text-xs text-slate-500">
          If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    </div>
  )
}
