'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User, Briefcase, Phone, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function AddEmployeePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const form = e.currentTarget
      const fd = new FormData(form)
      const payload: any = {
        employeeId: fd.get('employeeId'),
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        email: fd.get('email'),
        phone: fd.get('phone') || undefined,
        dateOfBirth: fd.get('dateOfBirth') || undefined,
        gender: fd.get('gender') || undefined,
        department: fd.get('department'),
        position: fd.get('position'),
        employmentType: String(fd.get('employmentType')||'').toUpperCase(),
        joinDate: fd.get('joinDate'),
        reportsTo: fd.get('reportsTo') || undefined,
        salary: fd.get('salary') ? Number(fd.get('salary')) : undefined,
        currency: fd.get('currency') || 'USD',
        address: fd.get('address') || undefined,
        city: fd.get('city') || undefined,
        country: fd.get('country') || undefined,
        emergencyContact: fd.get('emergencyContact') || undefined,
        emergencyPhone: fd.get('emergencyPhone') || undefined,
      }
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      router.push('/hrms/employees')
    } catch (err) {
      alert('Failed to save employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/hrms/employees"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gradient">Add New Employee</h1>
          <p className="text-muted-foreground mt-2">Enter employee information</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="gradient-border">
          <div className="gradient-border-content p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="text-purple-500" size={20} />
              <h2 className="text-xl font-semibold">Personal Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label text-muted-foreground">First Name *</label>
                <input
                  type="text"
                  required
                  name="firstName"
                  className="form-input px-4 py-2"
                  placeholder="John"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Last Name *</label>
                <input
                  type="text"
                  required
                  name="lastName"
                  className="form-input px-4 py-2"
                  placeholder="Doe"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Email *</label>
                <input
                  type="email"
                  required
                  name="email"
                  className="form-input px-4 py-2"
                  placeholder="john.doe@company.com"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input px-4 py-2"
                  placeholder="+1 234 567 8900"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  className="form-input px-4 py-2"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Gender</label>
                <select name="gender" className="form-input px-4 py-2">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="gradient-border">
          <div className="gradient-border-content p-6">
            <div className="flex items-center gap-2 mb-6">
              <Briefcase className="text-purple-500" size={20} />
              <h2 className="text-xl font-semibold">Employment Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label text-muted-foreground">Employee ID *</label>
                <input
                  type="text"
                  required
                  name="employeeId"
                  className="form-input px-4 py-2"
                  placeholder="EMP001"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Department *</label>
                <select
                  required
                  name="department"
                  className="form-input px-4 py-2"
                >
                  <option value="">Select Department</option>
                  <option value="engineering">Engineering</option>
                  <option value="marketing">Marketing</option>
                  <option value="sales">Sales</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance</option>
                </select>
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Position *</label>
                <input
                  type="text"
                  required
                  name="position"
                  className="form-input px-4 py-2"
                  placeholder="Senior Developer"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Employment Type *</label>
                <select
                  required
                  name="employmentType"
                  className="form-input px-4 py-2"
                >
                  <option value="">Select Type</option>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Join Date *</label>
                <input
                  type="date"
                  required
                  name="joinDate"
                  className="form-input px-4 py-2"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Reports To</label>
                <input
                  type="text"
                  name="reportsTo"
                  className="form-input px-4 py-2"
                  placeholder="Manager Employee ID"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Salary</label>
                <input
                  type="number"
                  name="salary"
                  className="form-input px-4 py-2"
                  placeholder="75000"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Currency</label>
                <select name="currency" className="form-input px-4 py-2">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="gradient-border">
          <div className="gradient-border-content p-6">
            <div className="flex items-center gap-2 mb-6">
              <Phone className="text-purple-500" size={20} />
              <h2 className="text-xl font-semibold">Contact Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="form-label text-muted-foreground">Address</label>
                <input
                  type="text"
                  name="address"
                  className="form-input px-4 py-2"
                  placeholder="123 Main Street"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">City</label>
                <input
                  type="text"
                  name="city"
                  className="form-input px-4 py-2"
                  placeholder="New York"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Country</label>
                <input
                  type="text"
                  name="country"
                  className="form-input px-4 py-2"
                  placeholder="United States"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Emergency Contact</label>
                <input
                  type="text"
                  name="emergencyContact"
                  className="form-input px-4 py-2"
                  placeholder="Jane Doe"
                />
              </div>
              
              <div>
                <label className="form-label text-muted-foreground">Emergency Phone</label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  className="form-input px-4 py-2"
                  placeholder="+1 234 567 8901"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Link
            href="/hrms/employees"
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </Link>
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save size={20} />
            <span>{loading ? 'Saving...' : 'Save Employee'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
