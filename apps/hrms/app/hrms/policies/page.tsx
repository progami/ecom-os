'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Filter, Download, FileText } from 'lucide-react'

type Policy = {
  id: string
  title: string
  category: 'LEAVE' | 'PERFORMANCE' | 'CONDUCT' | 'SECURITY' | 'COMPENSATION' | 'OTHER'
  summary?: string
  version?: string
  effectiveDate?: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  fileUrl?: string
}

// Policy data will be loaded from API
const empty: Policy[] = []

const categories = [
  { id: 'all', label: 'All' },
  { id: 'LEAVE', label: 'Leave' },
  { id: 'PERFORMANCE', label: 'Performance' },
  { id: 'CONDUCT', label: 'Conduct' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'COMPENSATION', label: 'Compensation' },
  { id: 'OTHER', label: 'Other' },
]

export default function PoliciesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [items, setItems] = useState<Policy[]>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ title: '', category: '', summary: '' })

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    params.set('take', '100')
    params.set('skip', '0')
    return params.toString()
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/policies?${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setItems(data.items || [])
      } catch (e: any) {
        if (e.name !== 'AbortError') setError('Failed to load policies')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [query])

  useEffect(() => {
    const handler = () => setSearchQuery(s => s) // trigger effect via state reference
    window.addEventListener('policies:reload', handler)
    return () => window.removeEventListener('policies:reload', handler)
  }, [])

  const statusColor = (status: Policy['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'ARCHIVED':
        return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      default:
        return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Policies</h1>
          <p className="text-muted-foreground mt-2">Company policies like leave and performance reviews</p>
        </div>
        
        <button onClick={() => setShowAdd(true)} className="btn btn-primary px-4 py-2 rounded-md flex items-center gap-2">
          <Plus size={20} />
          <span>Add Policy</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="gradient-border">
        <div className="gradient-border-content p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search policies by title or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input w-full pl-10 pr-4"
              />
            </div>
            <div>
              <button className="secondary-button"><Filter size={20} /> <span>Filters</span></button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  selectedCategory === c.id
                    ? 'bg-gray-100 text-primary dark:bg-gray-800'
                    : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="hrms-table-wrapper">
        <table className="hrms-table">
          <thead>
            <tr className="hrms-thead-row">
              <th className="hrms-th">Title</th>
              <th className="hrms-th">Category</th>
              <th className="hrms-th">Status</th>
              <th className="hrms-th">Version</th>
              <th className="hrms-th">Effective Date</th>
              <th className="hrms-th">File</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="hrms-row">
                <td className="hrms-td">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary" size={16} />
                    {p.fileUrl ? (
                      <a href={p.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:text-primary/80">{p.title}</a>
                    ) : (
                      <span className="font-medium">{p.title}</span>
                    )}
                  </div>
          {p.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.summary}</div>}
                </td>
                <td className="hrms-td">{p.category}</td>
                <td className="hrms-td">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span>
                </td>
                <td className="hrms-td">{p.version || '—'}</td>
                <td className="hrms-td">{p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString() : '—'}</td>
                <td className="hrms-td">
                  {p.fileUrl ? (
                    <a href={p.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
                      <Download size={14} /> Download
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <div className="text-center py-6 text-muted-foreground">Loading...</div>}
        {error && <div className="text-center py-6 text-red-400">{error}</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No policies found.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg gradient-border">
            <div className="gradient-border-content p-6">
              <h3 className="text-xl font-semibold mb-4">Add Policy</h3>
              <div className="grid grid-cols-1 gap-4">
                <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title *" className="form-input" />
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="form-input">
                  <option value="">Select Category *</option>
                  <option value="LEAVE">Leave</option>
                  <option value="PERFORMANCE">Performance</option>
                  <option value="CONDUCT">Conduct</option>
                  <option value="SECURITY">Security</option>
                  <option value="COMPENSATION">Compensation</option>
                  <option value="OTHER">Other</option>
                </select>
                <textarea value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})} placeholder="Summary" className="form-input" />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={()=>setShowAdd(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded">Cancel</button>
                <button disabled={saving} onClick={async()=>{
                  if(!form.title||!form.category){alert('Title and Category required');return}
                  setSaving(true)
                  const res=await fetch('/api/policies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
                  setSaving(false)
                  if(res.ok){ setShowAdd(false); setForm({title:'',category:'',summary:''}); window.dispatchEvent(new Event('policies:reload')); }
                  else alert('Failed to add')
                }} className="btn btn-primary px-4 py-2 rounded disabled:opacity-50">{saving?'Saving...':'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
