'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import ResourcesGrid from './components/ResourcesGrid'
import ResourceCategories from './components/ResourceCategories'
import { getSubcategories } from './components/resourceTaxonomy'

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ name: '', category: '', subcategory: '', email: '', phone: '', website: '' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Service Providers</h1>
          <p className="text-muted-foreground mt-2">Directory of accounting firms, CPAs, designers, and more</p>
        </div>
        
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity">
          <Plus size={20} />
          <span>Add Resource</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="gradient-border">
        <div className="gradient-border-content p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search resources by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input w-full pl-10 pr-4"
            />
          </div>
        </div>
      </div>

      {/* Resource Categories */}
      <ResourceCategories
        selectedCategory={selectedCategory}
        selectedSubcategories={selectedSubcategories}
        onCategoryChange={(c)=>{ setSelectedCategory(c); setSelectedSubcategories([]) }}
        onSubcategoriesChange={setSelectedSubcategories}
      />

      {/* Resources Table */}
      <ResourcesGrid searchQuery={searchQuery} selectedCategory={selectedCategory} selectedSubcategories={selectedSubcategories} />

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg gradient-border">
            <div className="gradient-border-content p-6">
              <h3 className="text-xl font-semibold mb-4">Add Provider</h3>
              <div className="grid grid-cols-1 gap-4">
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Name *" className="form-input" />
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="form-input">
                  <option value="">Select Category *</option>
                  <option value="ACCOUNTING">Accounting</option>
                  <option value="LEGAL">Legal</option>
                  <option value="DESIGN">Design</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="IT">IT Services</option>
                  <option value="HR">HR Services</option>
                  <option value="OTHER">Other</option>
                </select>
                {/* Subcategory (category-specific) */}
                <select
                  value={form.subcategory || ''}
                  onChange={e=>setForm({...form,subcategory:e.target.value})}
                  disabled={!form.category}
                  className="form-input disabled:opacity-50"
                >
                  <option value="">Select Subcategory</option>
                  {form.category && getSubcategories(form.category).map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" className="form-input" />
                <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone" className="form-input" />
                <input value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="Website" className="form-input" />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={()=>setShowAdd(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded">Cancel</button>
                <button disabled={saving} onClick={async()=>{
                  if(!form.name||!form.category){alert('Name and Category required');return}
                  setSaving(true)
                  const res=await fetch('/api/resources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
                  setSaving(false)
                  if(res.ok){ setShowAdd(false); setForm({name:'',category:'',email:'',phone:'',website:''}); window.dispatchEvent(new Event('resources:reload')); }
                  else alert('Failed to add')
                }} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded disabled:opacity-50">{saving?'Saving...':'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
