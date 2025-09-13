'use client'

import { Globe, Phone, Mail, Star, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SUBCATEGORIES } from './resourceTaxonomy'
import TableToolbar from '@/app/hrms/components/TableToolbar'
import { Edit, Check, X } from 'lucide-react'

interface ProviderResource {
  id: string
  name: string
  description?: string
  category: 'ACCOUNTING' | 'LEGAL' | 'DESIGN' | 'MARKETING' | 'IT' | 'HR' | 'OTHER'
  subcategory?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  rating?: number
  tags?: string[]
}

interface ResourcesGridProps {
  searchQuery: string
  selectedCategory: string
  selectedSubcategories?: string[]
}

export default function ResourcesGrid({ searchQuery, selectedCategory, selectedSubcategories = [] }: ResourcesGridProps) {
  const [items, setItems] = useState<ProviderResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<any>({})

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (selectedSubcategories.length > 0) {
      for (const s of selectedSubcategories) params.append('subcategory', s)
    }
    params.set('take', '100')
    params.set('skip', '0')
    return params.toString()
  }, [searchQuery, selectedCategory, JSON.stringify(selectedSubcategories), reloadTick])

  const dedupe = (arr: ProviderResource[]) => {
    const map = new Map<string, ProviderResource>()
    for (const r of arr) {
      const key = `${(r.website || '').toLowerCase()}__${r.name.toLowerCase()}__${r.category}__${(r.subcategory || '').toLowerCase()}`
      if (!map.has(key)) map.set(key, r)
    }
    return Array.from(map.values())
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/resources?${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setItems(dedupe(data.items || []))
      } catch (e: any) {
        if (e.name !== 'AbortError') setError('Failed to load resources')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [query])

  useEffect(() => {
    const handler = () => setReloadTick(t => t + 1)
    window.addEventListener('resources:reload', handler)
    return () => window.removeEventListener('resources:reload', handler)
  }, [])

  const websiteHost = (url?: string) => {
    if (!url) return ''
    try {
      const u = new URL(url)
      return u.host
    } catch {
      return url
    }
  }

  const parseCSV = async (file: File) => {
    const text = await file.text()
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
    if (lines.length < 2) return alert('CSV is empty')
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1).map(line => {
      const cells: string[] = []
      let cur = ''
      let inq = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inq && line[i+1] === '"') { cur += '"'; i++; }
          else inq = !inq
        } else if (ch === ',' && !inq) { cells.push(cur); cur=''; }
        else cur += ch
      }
      cells.push(cur)
      const obj: any = {}
      header.forEach((h, idx) => { obj[h] = (cells[idx]||'').trim() })
      return obj
    })
    for (const r of rows) {
      const payload: any = {
        name: r.name,
        category: (r.category || 'OTHER').toUpperCase(),
        subcategory: r.subcategory || undefined,
        contactName: r.contactname || r.contact,
        email: r.email,
        phone: r.phone,
        website: r.website?.startsWith('http') ? r.website : (r.website ? `https://${r.website}` : undefined),
        rating: r.rating ? Number(r.rating) : undefined,
      }
      if (!payload.name || !payload.category) continue
      await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setReloadTick(t => t + 1)
  }

  const exportCSV = async () => {
    const res = await fetch(`/api/resources?${query}`)
    if (!res.ok) return alert('Export failed')
    const data = await res.json()
    const rows = data.items || []
    const header = ['name','category','subcategory','contactName','email','phone','website','rating']
    const csv = [header.join(',')]
    for (const r of rows) {
      csv.push([
        r.name, r.category, r.subcategory||'', r.contactName||'', r.email||'', r.phone||'', r.website||'', typeof r.rating==='number'?r.rating.toFixed(1):''
      ].map((v:any) => (v ?? '').toString().replace(/"/g,'""')).map((v:string) => /[",\n]/.test(v)?`"${v}"`:v).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resources.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const startEdit = (r: ProviderResource) => {
    setEditingId(r.id)
    setEditDraft({ name: r.name, subcategory: r.subcategory || '', email: r.email || '', phone: r.phone || '', website: r.website || '' })
  }
  const cancelEdit = () => { setEditingId(null); setEditDraft({}) }
  const saveEdit = async (id: string) => {
    const payload = { ...editDraft, subcategory: editDraft.subcategory || null }
    const res = await fetch(`/api/resources/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) return alert('Failed to save')
    const updated = await res.json()
    setItems(prev => prev.map(r => r.id === id ? updated : r))
    setEditingId(null)
  }

  return (
    <div>
      <TableToolbar onImport={parseCSV} onExport={exportCSV} />
      <div className="hrms-table-wrapper">
      <table className="hrms-table">
        <thead>
          <tr className="hrms-thead-row">
            <th className="hrms-th">Name</th>
            <th className="hrms-th">Category</th>
            <th className="hrms-th">Subcategory</th>
            <th className="hrms-th">Contact</th>
            <th className="hrms-th">Email</th>
            <th className="hrms-th">Phone</th>
            <th className="hrms-th">Website</th>
            <th className="hrms-th">Rating</th>
            <th className="hrms-th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((resource) => (
            <tr key={resource.id} className="hrms-row">
              <td className="hrms-td">
                <div className="flex items-center gap-2">
                  {editingId === resource.id ? (
                    <input value={editDraft.name} onChange={e=>setEditDraft({...editDraft, name: e.target.value})} className="form-input px-2 py-1 w-full" />
                  ) : resource.website ? (
                    <a href={resource.website} target="_blank" rel="noreferrer" className="font-medium text-primary hover:text-primary/80">{resource.name}</a>
                  ) : (
                    <span className="font-medium">{resource.name}</span>
                  )}
                </div>
              </td>
              <td className="hrms-td">{resource.category}</td>
              <td className="hrms-td">
                {editingId === resource.id ? (
                  <select value={editDraft.subcategory} onChange={e=>setEditDraft({...editDraft, subcategory: e.target.value})} className="form-input px-2 py-1 w-auto">
                    <option value="">—</option>
                    {(SUBCATEGORIES[resource.category]||[]).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                ) : (
                  resource.subcategory
                    ? (SUBCATEGORIES[resource.category]?.find(s => s.id === resource.subcategory)?.label || resource.subcategory)
                    : '—'
                )}
              </td>
              <td className="hrms-td">{resource.contactName || '—'}</td>
              <td className="hrms-td">
                {editingId === resource.id ? (
                  <input value={editDraft.email} onChange={e=>setEditDraft({...editDraft, email: e.target.value})} className="form-input px-2 py-1 w-full" />
                ) : resource.email ? (
                  <span className="inline-flex items-center gap-1 text-foreground"><Mail size={14} /> {resource.email}</span>
                ) : '—'}
              </td>
              <td className="hrms-td">
                {editingId === resource.id ? (
                  <input value={editDraft.phone} onChange={e=>setEditDraft({...editDraft, phone: e.target.value})} className="form-input px-2 py-1 w-full" />
                ) : resource.phone ? (
                  <span className="inline-flex items-center gap-1 text-foreground"><Phone size={14} /> {resource.phone}</span>
                ) : '—'}
              </td>
              <td className="hrms-td">
                {editingId === resource.id ? (
                  <input value={editDraft.website} onChange={e=>setEditDraft({...editDraft, website: e.target.value})} className="form-input px-2 py-1 w-full" />
                ) : resource.website ? (
                  <a href={resource.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
                    <Globe size={14} /> {websiteHost(resource.website)} <ExternalLink size={14} />
                  </a>
                ) : '—'}
              </td>
              <td className="hrms-td">
                {typeof resource.rating === 'number' ? (
                  <span className="inline-flex items-center gap-1 text-yellow-500"><Star size={14} /> {resource.rating.toFixed(1)}</span>
                ) : '—'}
              </td>
              <td className="hrms-td">
                {editingId === resource.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={()=>saveEdit(resource.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Save"><Check size={16} /></button>
                    <button onClick={cancelEdit} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Cancel"><X size={16} /></button>
                  </div>
                ) : (
                  <button onClick={()=>startEdit(resource)} className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1"><Edit size={14} /> Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {loading && (
        <div className="text-center py-6 text-muted-foreground">Loading...</div>
      )}
      {error && (
        <div className="text-center py-6 text-red-400">{error}</div>
      )}
      {!loading && items.length === 0 && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No providers found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}
