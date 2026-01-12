/**
 * SOP Storage Layer
 *
 * Stores SOP configurations linked to QBO Account IDs.
 * Uses localStorage for now - can migrate to database later.
 *
 * IMPORTANT: SOPs only exist for accounts that come from QBO.
 * No hardcoded accounts - everything links to QBO Account IDs.
 */

import {
  type SopStore,
  type AccountSop,
  type GlobalSopFields,
  type SopServiceType,
  DEFAULT_SOP_STORE,
  DEFAULT_GLOBAL_FIELDS,
} from './types';

const STORAGE_KEY = 'plutus_sop_store';

/**
 * Get the entire SOP store
 */
export function getSopStore(): SopStore {
  if (typeof window === 'undefined') {
    return DEFAULT_SOP_STORE;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_SOP_STORE;
  }

  try {
    return JSON.parse(stored) as SopStore;
  } catch {
    console.error('Failed to parse SOP store');
    return DEFAULT_SOP_STORE;
  }
}

/**
 * Save the entire SOP store
 */
export function saveSopStore(store: SopStore): void {
  if (typeof window === 'undefined') {
    return;
  }

  store.updatedAt = new Date().toISOString();
  store.version += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Get SOP for a specific QBO account
 * Returns undefined if no SOP configured for this account
 */
export function getSopForAccount(qboAccountId: string): AccountSop | undefined {
  const store = getSopStore();
  return store.accountSops.find((sop) => sop.qboAccountId === qboAccountId);
}

/**
 * Create or update SOP for a QBO account
 * The account must exist in QBO - this just stores the configuration
 */
export function upsertAccountSop(sop: AccountSop): AccountSop {
  const store = getSopStore();
  const existingIndex = store.accountSops.findIndex(
    (s) => s.qboAccountId === sop.qboAccountId
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing
    store.accountSops[existingIndex] = {
      ...sop,
      updatedAt: now,
      version: (store.accountSops[existingIndex].version || 0) + 1,
    };
  } else {
    // Create new
    store.accountSops.push({
      ...sop,
      id: sop.id || crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  saveSopStore(store);
  return getSopForAccount(sop.qboAccountId)!;
}

/**
 * Delete SOP for a QBO account
 */
export function deleteAccountSop(qboAccountId: string): boolean {
  const store = getSopStore();
  const index = store.accountSops.findIndex(
    (sop) => sop.qboAccountId === qboAccountId
  );

  if (index >= 0) {
    store.accountSops.splice(index, 1);
    saveSopStore(store);
    return true;
  }

  return false;
}

/**
 * Get all configured SOPs
 */
export function getAllAccountSops(): AccountSop[] {
  const store = getSopStore();
  return store.accountSops;
}

/**
 * Get global fields
 */
export function getGlobalFields(): GlobalSopFields {
  const store = getSopStore();
  return store.globalFields || DEFAULT_GLOBAL_FIELDS;
}

/**
 * Update global fields
 */
export function updateGlobalFields(fields: GlobalSopFields): void {
  const store = getSopStore();
  store.globalFields = {
    ...fields,
    updatedAt: new Date().toISOString(),
    version: (store.globalFields?.version || 0) + 1,
  };
  saveSopStore(store);
}

/**
 * Add a service type to an account's SOP
 */
export function addServiceType(
  qboAccountId: string,
  serviceType: SopServiceType
): AccountSop | undefined {
  const sop = getSopForAccount(qboAccountId);
  if (!sop) {
    return undefined;
  }

  // Check if service type already exists
  const existingIndex = sop.serviceTypes.findIndex((st) => st.id === serviceType.id);
  if (existingIndex >= 0) {
    sop.serviceTypes[existingIndex] = serviceType;
  } else {
    sop.serviceTypes.push(serviceType);
  }

  return upsertAccountSop(sop);
}

/**
 * Remove a service type from an account's SOP
 */
export function removeServiceType(
  qboAccountId: string,
  serviceTypeId: string
): AccountSop | undefined {
  const sop = getSopForAccount(qboAccountId);
  if (!sop) {
    return undefined;
  }

  sop.serviceTypes = sop.serviceTypes.filter((st) => st.id !== serviceTypeId);
  return upsertAccountSop(sop);
}

/**
 * Generate reference from template and field values
 */
export function generateReference(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  // Clean up remaining placeholders and extra separators
  result = result
    .replace(/\{[^}]+\}/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  // QBO DocNumber max is 21 chars
  return result.slice(0, 21);
}

/**
 * Generate memo from template and field values
 */
export function generateMemo(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  // Clean up remaining placeholders and extra separators
  result = result
    .replace(/\{[^}]+\}/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  // QBO PrivateNote max is 4000 chars
  return result.slice(0, 4000);
}

/**
 * Export SOP store for backup
 */
export function exportSopStore(): string {
  const store = getSopStore();
  return JSON.stringify(store, null, 2);
}

/**
 * Import SOP store from backup
 */
export function importSopStore(json: string): boolean {
  try {
    const store = JSON.parse(json) as SopStore;
    // Validate structure
    if (!store.accountSops || !Array.isArray(store.accountSops)) {
      throw new Error('Invalid SOP store structure');
    }
    saveSopStore(store);
    return true;
  } catch (error) {
    console.error('Failed to import SOP store:', error);
    return false;
  }
}

/**
 * Clear all SOPs (for testing/reset)
 */
export function clearAllSops(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
