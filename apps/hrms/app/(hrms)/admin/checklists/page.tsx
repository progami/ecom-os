'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListPageHeader } from '@/components/ui/PageHeader';
import { ClipboardDocumentCheckIcon, UsersIcon } from '@/components/ui/Icons';
import {
  ChecklistTemplatesApi,
  EmployeesApi,
  HrmsSettingsApi,
  type ChecklistLifecycleType,
  type ChecklistOwnerType,
  type ChecklistTemplateItemInput,
} from '@/lib/api-client';

const OWNER_OPTIONS: Array<{ value: ChecklistOwnerType; label: string }> = [
  { value: 'HR', label: 'HR' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'IT', label: 'IT' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

function lifecycleLabel(value: ChecklistLifecycleType): string {
  return value === 'ONBOARDING' ? 'Onboarding' : 'Offboarding';
}

export default function AdminChecklistsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<
    Awaited<ReturnType<typeof ChecklistTemplatesApi.list>>['items']
  >([]);

  const [employees, setEmployees] = useState<
    Array<{ id: string; employeeId: string; firstName: string; lastName: string }>
  >([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof HrmsSettingsApi.get>> | null>(
    null,
  );

  const [newName, setNewName] = useState('');
  const [newLifecycleType, setNewLifecycleType] = useState<ChecklistLifecycleType>('ONBOARDING');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newItems, setNewItems] = useState<ChecklistTemplateItemInput[]>([
    {
      title: 'Create accounts and access',
      ownerType: 'IT',
      dueOffsetDays: 0,
      evidenceRequired: false,
      dependsOnIndex: null,
    },
    {
      title: 'Prepare workstation',
      ownerType: 'IT',
      dueOffsetDays: 0,
      evidenceRequired: false,
      dependsOnIndex: 0,
    },
    {
      title: 'Welcome + first-day agenda',
      ownerType: 'MANAGER',
      dueOffsetDays: 0,
      evidenceRequired: false,
      dependsOnIndex: null,
    },
  ]);

  const employeeOptions = useMemo(() => {
    return employees.map((e) => ({
      id: e.id,
      label: `${e.firstName} ${e.lastName} • ${e.employeeId}`.trim(),
    }));
  }, [employees]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, settingsRes, employeesRes] = await Promise.all([
        ChecklistTemplatesApi.list(),
        HrmsSettingsApi.get(),
        EmployeesApi.list({ take: 200 }),
      ]);
      setTemplates(templatesRes.items ?? []);
      setSettings(settingsRes);
      setEmployees(
        (employeesRes.items ?? []).map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load checklists admin';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings(next: {
    defaultHROwnerId?: string | null;
    defaultITOwnerId?: string | null;
  }) {
    setSaving(true);
    setError(null);
    try {
      await HrmsSettingsApi.update(next);
      const refreshed = await HrmsSettingsApi.get();
      setSettings(refreshed);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setError(null);
    try {
      await ChecklistTemplatesApi.update(id, { isActive: !isActive });
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update template';
      setError(message);
    }
  }

  async function createTemplate() {
    setSaving(true);
    setError(null);
    try {
      if (!newName.trim()) {
        setError('Template name is required.');
        return;
      }
      const cleanedItems = newItems
        .map((i) => ({
          ...i,
          title: i.title.trim(),
          description: i.description?.trim() || null,
        }))
        .filter((i) => i.title.length > 0);

      if (cleanedItems.length === 0) {
        setError('Add at least one item.');
        return;
      }

      await ChecklistTemplatesApi.create({
        name: newName.trim(),
        lifecycleType: newLifecycleType,
        isActive: newIsActive,
        items: cleanedItems,
      });
      setNewName('');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create template';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ListPageHeader
        title="Checklist Templates"
        description="Configure onboarding/offboarding templates and default owners."
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/onboarding" variant="secondary" icon={<UsersIcon className="h-4 w-4" />}>
            Onboarding dashboard
          </Button>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Card padding="lg">
          <p className="text-sm text-gray-600">Loading…</p>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card padding="md">
            <p className="text-sm text-gray-700">
              Templates define the standard steps for onboarding/offboarding. HR starts an
              onboarding checklist from the Onboarding dashboard, and HRMS creates tasks from the
              template items.
            </p>
          </Card>

          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-900">Default owners</h2>
            <p className="text-xs text-gray-500 mt-1">
              Used when checklist items are assigned to HR or IT. Pick a single owner for each queue
              (v2 will add role-based queues).
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-700">Default HR owner</label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={settings?.defaultHROwnerId ?? ''}
                  onChange={(e) => saveSettings({ defaultHROwnerId: e.target.value || null })}
                  disabled={saving}
                >
                  <option value="">Not set</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Default IT owner</label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={settings?.defaultITOwnerId ?? ''}
                  onChange={(e) => saveSettings({ defaultITOwnerId: e.target.value || null })}
                  disabled={saving}
                >
                  <option value="">Not set</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Templates</h2>
                <p className="text-xs text-gray-500 mt-1">Create and manage checklist templates.</p>
              </div>
            </div>

            {templates.length === 0 ? (
              <p className="text-sm text-gray-600 mt-4">No templates yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Lifecycle</th>
                      <th className="py-2 pr-4">Version</th>
                      <th className="py-2 pr-4">Items</th>
                      <th className="py-2 pr-4">Instances</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-0 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {templates.map((t) => (
                      <tr key={t.id}>
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          <Link
                            href={`/admin/checklists/templates/${t.id}`}
                            className="hover:underline"
                          >
                            {t.name}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">
                          {lifecycleLabel(t.lifecycleType)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">v{t.version}</td>
                        <td className="py-3 pr-4 text-gray-700">{t._count?.items ?? '—'}</td>
                        <td className="py-3 pr-4 text-gray-700">{t._count?.instances ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              t.isActive
                                ? 'text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5'
                                : 'text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5'
                            }
                          >
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 pr-0 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              href={`/admin/checklists/templates/${t.id}`}
                              variant="secondary"
                            >
                              View
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => toggleActive(t.id, t.isActive)}
                            >
                              {t.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-900">Create template</h2>
            <p className="text-xs text-gray-500 mt-1">
              Start simple; iterate as workflows stabilize.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-700">Name</label>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Standard onboarding"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Lifecycle</label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={newLifecycleType}
                  onChange={(e) => setNewLifecycleType(e.target.value as ChecklistLifecycleType)}
                >
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="OFFBOARDING">Offboarding</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active
              </label>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</h3>
              {newItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-gray-700">Title</label>
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                        value={item.title}
                        onChange={(e) => {
                          const next = [...newItems];
                          next[idx] = { ...next[idx]!, title: e.target.value };
                          setNewItems(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Owner</label>
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                        value={item.ownerType}
                        onChange={(e) => {
                          const next = [...newItems];
                          next[idx] = {
                            ...next[idx]!,
                            ownerType: e.target.value as ChecklistOwnerType,
                          };
                          setNewItems(next);
                        }}
                      >
                        {OWNER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Due offset (days)</label>
                      <input
                        type="number"
                        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                        value={item.dueOffsetDays ?? 0}
                        min={0}
                        max={365}
                        onChange={(e) => {
                          const next = [...newItems];
                          next[idx] = {
                            ...next[idx]!,
                            dueOffsetDays: Number.parseInt(e.target.value || '0', 10),
                          };
                          setNewItems(next);
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-gray-700">Description</label>
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                        value={item.description ?? ''}
                        onChange={(e) => {
                          const next = [...newItems];
                          next[idx] = { ...next[idx]!, description: e.target.value };
                          setNewItems(next);
                        }}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Depends on</label>
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                        value={item.dependsOnIndex ?? ''}
                        onChange={(e) => {
                          const next = [...newItems];
                          const value =
                            e.target.value === '' ? null : Number.parseInt(e.target.value, 10);
                          next[idx] = { ...next[idx]!, dependsOnIndex: value };
                          setNewItems(next);
                        }}
                      >
                        <option value="">None</option>
                        {newItems.slice(0, idx).map((prev, prevIdx) => (
                          <option key={prevIdx} value={prevIdx}>
                            {prevIdx + 1}. {prev.title || 'Untitled'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={item.evidenceRequired ?? false}
                        onChange={(e) => {
                          const next = [...newItems];
                          next[idx] = { ...next[idx]!, evidenceRequired: e.target.checked };
                          setNewItems(next);
                        }}
                      />
                      Evidence required
                    </label>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        const next = [...newItems];
                        next.splice(idx, 1);
                        setNewItems(
                          next.length ? next : [{ title: '', ownerType: 'HR', dueOffsetDays: 0 }],
                        );
                      }}
                      disabled={newItems.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setNewItems([...newItems, { title: '', ownerType: 'HR', dueOffsetDays: 0 }])
                  }
                >
                  Add item
                </Button>
                <Button onClick={createTemplate} disabled={saving}>
                  {saving ? 'Saving…' : 'Create template'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
