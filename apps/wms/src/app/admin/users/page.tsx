'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Search, MoreVertical, Mail, Users } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { buildCentralLoginUrl } from '@/lib/utils/url'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    if (typeof window !== 'undefined') {
      window.location.replace(buildCentralLoginUrl('/admin/users'))
    }
    return null
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Users"
          description="Administration"
          icon={Users}
          actions={
            <Link
              href="/admin/users/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-soft text-sm font-medium text-white bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Link>
          }
        />
        <PageContent>

        {/* Search */}
        <div className="max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Users Grid */}
        <div className="bg-secondary p-2 rounded-lg mb-2">
          <p className="text-sm text-foreground">Showing 3 users</p>
        </div>
        <div className="grid gap-1 md:grid-cols-2 lg:grid-cols-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <UserCard
            name="System Administrator"
            email="admin@warehouse.com"
            role="admin"
            warehouse="All Warehouses"
            lastLogin="2 hours ago"
            isActive={true}
          />
          <UserCard
            name="Hashar (Finance Manager)"
            email="hashar@warehouse.com"
            role="staff"
            warehouse="All Warehouses"
            lastLogin="1 day ago"
            isActive={true}
          />
          <UserCard
            name="Umair (Operations Manager)"
            email="umair@warehouse.com"
            role="staff"
            warehouse="FMC"
            lastLogin="3 hours ago"
            isActive={true}
          />
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

interface UserCardProps {
  name: string
  email: string
  role: string
  warehouse: string
  lastLogin: string
  isActive: boolean
}

function UserCard({ name, email, role, warehouse, lastLogin, isActive }: UserCardProps) {
  const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      admin: 'bg-brand-teal-100 text-brand-teal-800',
      staff: 'bg-cyan-100 text-cyan-800',
    }
    
    const roleLabels: Record<string, string> = {
      admin: 'System Admin',
      staff: 'Staff',
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyles[role] || 'bg-muted text-foreground'}`}>
        {roleLabels[role] || role}
      </span>
    )
  }

  return (
    <div className="border rounded-lg p-2 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-medium text-foreground">
                {name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-foreground">{name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {email}
              </p>
            </div>
          </div>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              {getRoleBadge(role)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Warehouse</span>
              <span className="text-sm font-medium">{warehouse}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Login</span>
              <span className="text-sm">{lastLogin}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        
        <button className="ml-4 text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
