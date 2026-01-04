'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PoliciesApi } from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { executeAction } from '@/lib/actions/execute-action'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'

export default function PolicyWorkflowPage() {
  const params = useParams()
  const id = params.id as string

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [policy, setPolicy] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [workflow, raw] = await Promise.all([
        PoliciesApi.getWorkflowRecord(id),
        PoliciesApi.get(id),
      ])
      setDto(workflow)
      setPolicy(raw)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load policy'
      setError(message)
      setDto(null)
      setPolicy(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const onAction = useCallback(async (actionId: ActionId) => {
    setError(null)
    try {
      await executeAction(actionId, { type: 'POLICY', id })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [id, load])

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </Card>
    )
  }

  if (!dto) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Policy</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
      </Card>
    )
  }

  return (
    <>
      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <WorkflowRecordLayout data={dto} onAction={onAction}>
        {policy ? (
          <div className="space-y-6">
            {policy.summary ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Summary</h3>
                <p className="text-sm text-foreground whitespace-pre-line">{policy.summary}</p>
              </Card>
            ) : null}

            {policy.content ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-4">Policy content</h3>
                <div className="prose prose-sm max-w-none prose-headings:text-accent prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-accent/20 prose-h2:pb-2 prose-h2:mt-6 prose-table:text-sm prose-th:bg-accent/5 prose-th:text-primary prose-th:p-2 prose-th:border prose-th:border-accent/20 prose-td:p-2 prose-td:border prose-td:border-border prose-strong:text-primary prose-a:text-accent hover:prose-a:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {policy.content}
                  </ReactMarkdown>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </WorkflowRecordLayout>
    </>
  )
}

