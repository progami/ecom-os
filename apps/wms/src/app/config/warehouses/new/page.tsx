'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const formatAddress = (address: {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
}) => {
  const lines = []
  if (address.addressLine1.trim()) lines.push(address.addressLine1.trim())
  if (address.addressLine2.trim()) lines.push(address.addressLine2.trim())

  const cityValue = address.city.trim()
  const stateValue = address.state.trim().toUpperCase()
  const postalValue = address.postalCode.trim()

  let cityStateZip = ''
  if (cityValue) cityStateZip += cityValue
  if (stateValue) cityStateZip += cityStateZip ? `, ${stateValue}` : stateValue
  if (postalValue) cityStateZip += cityStateZip ? ` ${postalValue}` : postalValue
  if (cityStateZip) lines.push(cityStateZip)

  return lines.join('\n')
}

export default function NewWarehousePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    contactEmail: '',
    contactPhone: '',
    isActive: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    const normalizedCode = formData.code.trim()

    if (!normalizedCode) {
      newErrors.code = 'Warehouse code is required'
    } else if (normalizedCode.replace(/\s+/g, '-').length > 10) {
      newErrors.code = 'Code must be 10 characters or less (spaces become dashes)'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Warehouse name is required'
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address line 1 is required'
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }

    if (!/^[A-Za-z]{2}$/.test(formData.state.trim().toUpperCase())) {
      newErrors.state = 'State must be a 2-letter code'
    }

    if (!/^\d{5}(?:-\d{4})?$/.test(formData.postalCode.trim())) {
      newErrors.postalCode = 'ZIP code must be 5 digits (optional +4)'
    }

    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    try {
      const normalizedCode = formData.code.trim().toUpperCase().replace(/\s+/g, '-')
      const formattedAddress = formatAddress({
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
      })

      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normalizedCode,
          name: formData.name,
          address: formattedAddress,
          contactEmail: formData.contactEmail.trim() || undefined,
          contactPhone: formData.contactPhone || undefined,
          isActive: formData.isActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create warehouse')
      }

      alert('Warehouse created successfully!')
      router.push('/config/warehouses')
    } catch (error) {
      alert((error as Error).message || 'Failed to create warehouse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/config/warehouses">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create New Warehouse</h1>
            <p className="text-muted-foreground">Add a new warehouse to the system</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Warehouse Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.code ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., FMC, VG001"
                  maxLength={10}
                />
                {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code}</p>}
                <p className="text-slate-500 text-xs mt-1">Unique identifier, max 10 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                  placeholder="e.g., Fulfillment Center Miami"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.addressLine1 ? 'border-red-500' : ''
                  }`}
                  placeholder="Street address"
                />
                {errors.addressLine1 && (
                  <p className="text-red-500 text-sm mt-1">{errors.addressLine1}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.city ? 'border-red-500' : ''
                    }`}
                    placeholder="City"
                  />
                  {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value.toUpperCase() })
                    }
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.state ? 'border-red-500' : ''
                    }`}
                    placeholder="e.g., NY"
                    maxLength={2}
                  />
                  {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ZIP code *
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.postalCode ? 'border-red-500' : ''
                    }`}
                    placeholder="e.g., 10001"
                  />
                  {errors.postalCode && (
                    <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.contactEmail ? 'border-red-500' : ''
                  }`}
                  placeholder="warehouse@example.com"
                />
                {errors.contactEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.contactEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-slate-700">
                Active warehouse (can receive transactions)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t">
            <Button asChild variant="ghost">
              <Link href="/config/warehouses">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Create Warehouse
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
