'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Package2, Plus, Loader2 } from '@/lib/lucide-icons'
import ProductsPanel from './products-panel'

const ALLOWED_ROLES = ['admin']

export default function ProductsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', `${window.location.origin}/config/products`)
      window.location.href = url.toString()
      return
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      toast.error('You are not authorised to manage products')
      router.push('/dashboard')
    }
  }, [router, session, status])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading…</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-2">
        <PageHeader
          title="Products"
          subtitle="Maintain SKU definitions and packaging information"
          icon={Package2}
          iconColor="text-cyan-600"
          bgColor="bg-cyan-50"
          borderColor="border-cyan-200"
          textColor="text-cyan-800"
          actions={
            <Button asChild className="gap-2">
              <Link href="/config/products/new">
                <Plus className="h-4 w-4" />
                Create Product
              </Link>
            </Button>
          }
        />

        <ProductsPanel />
      </div>
    </DashboardLayout>
  )
}
