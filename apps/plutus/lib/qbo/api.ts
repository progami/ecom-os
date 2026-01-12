import { getApiBaseUrl, refreshAccessToken } from './client';
import { createLogger } from '@targon/logger';

const logger = createLogger({ name: 'qbo-api' });

// Default timeout for QBO API calls (60 seconds)
const QBO_TIMEOUT_MS = 60000;

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = QBO_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface QboConnection {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface QboPurchase {
  Id: string;
  SyncToken: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentType: 'Cash' | 'Check' | 'CreditCard';
  DocNumber?: string;
  PrivateNote?: string;
  EntityRef?: {
    value: string;
    name: string;
  };
  AccountRef?: {
    value: string;
    name: string;
  };
  Line?: Array<{
    Id: string;
    Amount: number;
    Description?: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef: {
        value: string;
        name: string;
      };
    };
  }>;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
  AcctNum?: string;
  Active?: boolean;
  CurrentBalance?: number;
  CurrentBalanceWithSubAccounts?: number;
  CurrencyRef?: {
    value: string;
    name?: string;
  };
  Classification?: string;
}

export interface QboQueryResponse {
  QueryResponse: {
    Purchase?: QboPurchase[];
    Account?: QboAccount[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  time: string;
}

export interface FetchPurchasesOptions {
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  startPosition?: number;
}

/**
 * Ensure we have a valid access token, refreshing if needed
 */
export async function getValidToken(
  connection: QboConnection
): Promise<{ accessToken: string; updatedConnection?: QboConnection }> {
  const expiresAt = new Date(connection.expiresAt);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    logger.info('Access token expired or expiring soon, refreshing...');
    const newTokens = await refreshAccessToken(connection.refreshToken);
    const updatedConnection: QboConnection = {
      ...connection,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
    };
    return { accessToken: newTokens.accessToken, updatedConnection };
  }

  return { accessToken: connection.accessToken };
}

/**
 * Fetch Purchase transactions from QBO
 */
export async function fetchPurchases(
  connection: QboConnection,
  options: FetchPurchasesOptions = {}
): Promise<{ purchases: QboPurchase[]; totalCount: number; updatedConnection?: QboConnection }> {
  const { accessToken, updatedConnection } = await getValidToken(connection);
  const baseUrl = getApiBaseUrl();

  const { startDate, endDate, maxResults = 100, startPosition = 1 } = options;

  // Build query
  let query = `SELECT * FROM Purchase`;
  const conditions: string[] = [];

  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`);
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDERBY TxnDate DESC`;
  query += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;

  const queryUrl = `${baseUrl}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(query)}`;

  logger.info('Fetching purchases from QBO', { query });

  const response = await fetchWithTimeout(queryUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch purchases', { status: response.status, error: errorText });
    throw new Error(`Failed to fetch purchases: ${response.status} ${errorText}`);
  }

  const data: QboQueryResponse = await response.json();
  const purchases = data.QueryResponse?.Purchase || [];

  // Get total count with a separate query if we have results
  let totalCount = purchases.length;
  if (purchases.length > 0) {
    const countQuery = `SELECT COUNT(*) FROM Purchase${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
    const countUrl = `${baseUrl}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(countQuery)}`;

    try {
      const countResponse = await fetchWithTimeout(countUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }, 30000); // 30 second timeout for count query
      if (countResponse.ok) {
        const countData = await countResponse.json();
        totalCount = countData.QueryResponse?.totalCount || purchases.length;
      }
    } catch {
      // Ignore count errors, use purchases.length as fallback
    }
  }

  return { purchases, totalCount, updatedConnection };
}

/**
 * Fetch a single Purchase by ID
 */
export async function fetchPurchaseById(
  connection: QboConnection,
  purchaseId: string
): Promise<{ purchase: QboPurchase; updatedConnection?: QboConnection }> {
  const { accessToken, updatedConnection } = await getValidToken(connection);
  const baseUrl = getApiBaseUrl();

  const url = `${baseUrl}/v3/company/${connection.realmId}/purchase/${purchaseId}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch purchase', { purchaseId, status: response.status, error: errorText });
    throw new Error(`Failed to fetch purchase: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { purchase: data.Purchase, updatedConnection };
}

/**
 * Update a Purchase transaction (sparse update for DocNumber and PrivateNote)
 */
export async function updatePurchase(
  connection: QboConnection,
  purchaseId: string,
  syncToken: string,
  paymentType: string,
  updates: { docNumber?: string; privateNote?: string }
): Promise<{ purchase: QboPurchase; updatedConnection?: QboConnection }> {
  const { accessToken, updatedConnection } = await getValidToken(connection);
  const baseUrl = getApiBaseUrl();

  const url = `${baseUrl}/v3/company/${connection.realmId}/purchase?operation=update`;

  const payload: Record<string, unknown> = {
    Id: purchaseId,
    SyncToken: syncToken,
    sparse: true,
    PaymentType: paymentType,
  };

  if (updates.docNumber !== undefined) {
    payload.DocNumber = updates.docNumber;
  }
  if (updates.privateNote !== undefined) {
    payload.PrivateNote = updates.privateNote;
  }

  logger.info('Updating purchase in QBO', { purchaseId, updates });

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to update purchase', { purchaseId, status: response.status, error: errorText });
    throw new Error(`Failed to update purchase: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { purchase: data.Purchase, updatedConnection };
}

/**
 * Fetch Chart of Accounts from QBO
 */
export async function fetchAccounts(
  connection: QboConnection
): Promise<{ accounts: QboAccount[]; updatedConnection?: QboConnection }> {
  const { accessToken, updatedConnection } = await getValidToken(connection);
  const baseUrl = getApiBaseUrl();

  const query = `SELECT * FROM Account WHERE Active = true MAXRESULTS 1000`;
  const queryUrl = `${baseUrl}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(query)}`;

  logger.info('Fetching accounts from QBO');

  const response = await fetchWithTimeout(queryUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch accounts', { status: response.status, error: errorText });
    throw new Error(`Failed to fetch accounts: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { accounts: data.QueryResponse?.Account || [], updatedConnection };
}
