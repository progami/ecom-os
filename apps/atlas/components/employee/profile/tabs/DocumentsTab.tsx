'use client'

import type { ChangeEvent } from 'react'
import type { EmployeeFile } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatBytes, formatDate } from '../utils'

export function EmployeeDocumentsTab({
  canUpload,
  canManageVisibility,
  isSelf,
  uploadReady,
  uploadTitle,
  setUploadTitle,
  uploadVisibility,
  setUploadVisibility,
  setUploadFile,
  uploading,
  uploadDocument,
  files,
  filesLoading,
  downloadFile,
}: {
  canUpload: boolean
  canManageVisibility: boolean
  isSelf: boolean
  uploadReady: boolean
  uploadTitle: string
  setUploadTitle: (value: string) => void
  uploadVisibility: 'HR_ONLY' | 'EMPLOYEE_AND_HR'
  setUploadVisibility: (value: 'HR_ONLY' | 'EMPLOYEE_AND_HR') => void
  setUploadFile: (value: File | null) => void
  uploading: boolean
  uploadDocument: () => void
  files: EmployeeFile[]
  filesLoading: boolean
  downloadFile: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      {canUpload ? (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-foreground mb-4">Upload Document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-xs">Title (optional)</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Offer Letter"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Who can view?</Label>
              <NativeSelect
                value={uploadVisibility}
                onChange={(e) => setUploadVisibility(e.target.value as 'HR_ONLY' | 'EMPLOYEE_AND_HR')}
                disabled={!canManageVisibility}
                className="mt-1"
              >
                <option value="HR_ONLY">HR only (private)</option>
                <option value="EMPLOYEE_AND_HR">Employee can view</option>
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">File</Label>
              <Input
                type="file"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>
            <div>
              <Button onClick={uploadDocument} disabled={!uploadReady || uploading} className="w-full">
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>
          {!canManageVisibility && isSelf ? (
            <p className="text-xs text-muted-foreground mt-3">
              Documents you upload will be visible to you and HR.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card padding="md">
        <h2 className="text-sm font-semibold text-foreground mb-4">Files</h2>
        {filesLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8">
            <DocumentIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((f) => (
              <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{f.title || f.fileName}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{formatDate(f.uploadedAt)}</span>
                    <span>{formatBytes(f.size)}</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        f.visibility === 'HR_ONLY'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-accent/10 text-accent'
                      )}
                    >
                      {f.visibility === 'HR_ONLY' ? 'HR only' : 'Shared'}
                    </span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => downloadFile(f.id)}>
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
