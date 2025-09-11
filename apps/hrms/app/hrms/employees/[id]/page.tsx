'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Edit2, Trash2, Plus, LinkIcon } from 'lucide-react'

type Employee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  department: string
  position: string
  employmentType: string
  joinDate: string
  status: string
}

type EmpFile = { id: string; title: string; fileUrl: string; uploadedAt: string }

export default function EmployeeDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [item, setItem] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  const [files, setFiles] = useState<EmpFile[]>([])
  const [newFile, setNewFile] = useState<{ title: string; file?: File | null }>({ title: '' })
  const [savingFile, setSavingFile] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Prefer exact employeeId search for stability
        let res = await fetch(`/api/employees?employeeId=${encodeURIComponent(String(id))}`)
        if (!res.ok) {
          // Fallback to direct id lookup
          res = await fetch(`/api/employees/${id}`, { signal: controller.signal })
        }
        if (!res.ok) throw new Error(await res.text())
        const payload = await res.json()
        const data = payload?.items ? payload.items[0] : payload
        setItem(data)
        setForm({
          employeeId: data.employeeId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || '',
          department: data.department,
          position: data.position,
          employmentType: data.employmentType,
          joinDate: data.joinDate?.slice(0, 10),
          status: data.status,
        })
      } catch (e: any) {
        setError('Failed to load employee')
      } finally {
        setLoading(false)
      }
    }
    const loadFiles = async () => {
      try {
        const res = await fetch(`/api/employees/${id}/files`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setFiles(data.items || [])
      } catch {}
    }
    load()
    loadFiles()
    return () => controller.abort()
  }, [id])

  const save = async () => {
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) return alert('Failed to save')
    const data = await res.json()
    setItem(data)
    setEditing(false)
  }

  const addFile = async () => {
    if (!newFile.file) return alert('Please choose a file')
    const title = newFile.title || newFile.file.name
    setSavingFile(true)
    try {
      const presign = await fetch(`/api/employees/${id}/files/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newFile.file.name, contentType: newFile.file.type || 'application/octet-stream' }),
      })
      if (!presign.ok) throw new Error(await presign.text())
      const { uploadUrl, publicUrl, key } = await presign.json()
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': newFile.file.type || 'application/octet-stream' }, body: newFile.file })
      if (!put.ok) throw new Error('Upload failed')
      const saveRes = await fetch(`/api/employees/${id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, key, fileUrl: publicUrl }),
      })
      if (!saveRes.ok) throw new Error(await saveRes.text())
      const item = await saveRes.json()
      setFiles((prev) => [item, ...prev])
      setNewFile({ title: '' })
    } catch (e: any) {
      alert(e.message || 'Failed to add file')
    } finally {
      setSavingFile(false)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Delete this file?')) return
    const res = await fetch(`/api/employees/${id}/files/${fileId}`, { method: 'DELETE' })
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (error) return <div className="p-6 text-red-400">{error}</div>
  if (!item) return <div className="p-6 text-slate-400">Not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hrms/employees" className="px-2 py-1 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-2xl font-bold">{item.firstName} {item.lastName}</h1>
          <span className="text-slate-500">({item.employeeId})</span>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2"><Edit2 size={16} /> Edit</button>
          ) : (
            <button onClick={save} className="px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2"><Save size={16} /> Save</button>
          )}
        </div>
      </div>

      {/* Essentials */}
      <div className="hrms-table-wrapper">
        <table className="hrms-table">
          <thead>
            <tr className="hrms-thead-row">
              <th className="hrms-th">Field</th>
              <th className="hrms-th">Value</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Email', 'email'],
              ['Phone', 'phone'],
              ['Department', 'department'],
              ['Position', 'position'],
              ['Employment Type', 'employmentType'],
              ['Status', 'status'],
              ['Join Date', 'joinDate'],
            ].map(([label, key]) => (
              <tr key={key as string} className="hrms-row">
                <td className="hrms-td w-48">{label}</td>
                <td className="hrms-td">
                  {!editing ? (
                    key === 'joinDate' ? (item.joinDate ? new Date(item.joinDate).toLocaleDateString() : '—') : (item as any)[key] || '—'
                  ) : (
                    key === 'joinDate' ? (
                      <input type="date" value={form.joinDate || ''} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded" />
                    ) : (
                      <input value={form[key as string] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded w-full max-w-md" />
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Files */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Files</h2>
          <div className="flex gap-2">
            <input
              placeholder="Title (e.g., Offer Letter)"
              value={newFile.title}
              onChange={(e) => setNewFile({ ...newFile, title: e.target.value })}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded"
            />
            <input
              type="file"
              onChange={(e) => setNewFile({ ...newFile, file: e.target.files?.[0] || null })}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded w-80"
            />
            <button disabled={savingFile} onClick={addFile} className="px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        <div className="hrms-table-wrapper">
          <table className="hrms-table">
            <thead>
              <tr className="hrms-thead-row">
                <th className="hrms-th">Title</th>
                <th className="hrms-th">File</th>
                <th className="hrms-th">Uploaded</th>
                <th className="hrms-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="hrms-row">
                  <td className="hrms-td font-medium">{f.title}</td>
                  <td className="hrms-td">
                    <a href={f.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300">
                      <LinkIcon size={14} /> View
                    </a>
                  </td>
                  <td className="hrms-td">{new Date(f.uploadedAt).toLocaleString()}</td>
                  <td className="hrms-td">
                    <button onClick={() => deleteFile(f.id)} className="px-2 py-1 border border-slate-700 rounded text-red-300 hover:bg-slate-800 flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr className="hrms-row"><td className="hrms-td" colSpan={4}>No files yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
