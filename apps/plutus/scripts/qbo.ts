import {
  getServerQboConnectionPath,
  loadServerQboConnection,
  saveServerQboConnection,
} from '@/lib/qbo/connection-store';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const AMAZON_DUPLICATE_ACCOUNTS = [
  'Amazon Sales',
  'Amazon Refunds',
  'Amazon Reimbursement',
  'Amazon Reimbursements',
  'Amazon Shipping',
  'Amazon Advertising',
  'Amazon FBA Fees',
  'Amazon Seller Fees',
  'Amazon Storage Fees',
  'Amazon FBA Inventory Reimbursement',
  'Amazon Carried Balances',
  'Amazon Pending Balances',
  'Amazon Deferred Balances',
  'Amazon Reserved Balances',
  'Amazon Split Month Rollovers',
  'Amazon Loans',
  'Amazon Sales Tax',
  'Amazon Sales Tax Collected',
] as const;

type QboConnection = {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

function printUsage(): void {
  console.log('Usage: pnpm qbo <command>');
  console.log('');
  console.log('Commands:');
  console.log('  connection:show');
  console.log('  accounts:deactivate <name...>');
  console.log('  accounts:deactivate-amazon-duplicates');
  console.log('');
}

function parseDotenvLine(rawLine: string): { key: string; value: string } | null {
  let line = rawLine.trim();
  if (line === '' || line.startsWith('#')) return null;

  if (line.startsWith('export ')) {
    line = line.slice('export '.length).trim();
  }

  const equalsIndex = line.indexOf('=');
  if (equalsIndex === -1) return null;

  const key = line.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = line.slice(equalsIndex + 1).trim();

  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  if (hasSingleQuotes || hasDoubleQuotes) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

async function loadEnvFile(filePath: string): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return;
    throw error;
  }

  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseDotenvLine(line);
    if (!parsed) continue;

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

async function loadPlutusEnv(): Promise<void> {
  const cwd = process.cwd();
  await loadEnvFile(path.join(cwd, '.env.local'));
  await loadEnvFile(path.join(cwd, '.env'));
}

async function requireServerConnection(): Promise<QboConnection> {
  const connection = await loadServerQboConnection();
  if (!connection) {
    throw new Error(
      `No server-stored QBO connection found at ${getServerQboConnectionPath()}. Connect to QBO in Plutus first.`
    );
  }

  const { getValidToken } = await import('@/lib/qbo/api');
  const { updatedConnection } = await getValidToken(connection);
  if (updatedConnection) {
    await saveServerQboConnection(updatedConnection);
    return updatedConnection;
  }

  return connection;
}

async function showConnection(): Promise<void> {
  const connection = await requireServerConnection();
  console.log(JSON.stringify({ realmId: connection.realmId, expiresAt: connection.expiresAt }, null, 2));
}

async function deactivateAmazonDuplicateAccounts(): Promise<void> {
  await deactivateAccountsByName([...AMAZON_DUPLICATE_ACCOUNTS]);
}

async function deactivateAccountsByName(accountNames: string[]): Promise<void> {
  let connection = await requireServerConnection();

  const { fetchAccounts, updateAccountActive } = await import('@/lib/qbo/api');
  const { accounts, updatedConnection } = await fetchAccounts(connection);
  if (updatedConnection) {
    connection = updatedConnection;
    await saveServerQboConnection(updatedConnection);
  }

  const targets = new Set(accountNames.map((name) => name.toLowerCase()));
  const matches = accounts.filter((account) => targets.has(account.Name.toLowerCase()));

  const matchedNames = new Set(matches.map((account) => account.Name.toLowerCase()));
  const missing = accountNames.filter((name) => !matchedNames.has(name.toLowerCase()));

  console.log(JSON.stringify({ totalTargets: accountNames.length, matched: matches.length, missing: missing.length }, null, 2));

  for (const account of matches) {
    const result = await updateAccountActive(connection, account.Id, account.SyncToken, account.Name, false);
    if (result.updatedConnection) {
      connection = result.updatedConnection;
      await saveServerQboConnection(result.updatedConnection);
    }
    console.log(JSON.stringify({ deactivated: account.Name, id: account.Id }, null, 2));
  }

  if (missing.length > 0) {
    console.log(JSON.stringify({ missing }, null, 2));
  }
}

async function main(): Promise<void> {
  await loadPlutusEnv();
  const [command] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === 'connection:show') {
    await showConnection();
    return;
  }

  if (command === 'accounts:deactivate') {
    const accountNames = process.argv.slice(3);
    if (accountNames.length === 0) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    await deactivateAccountsByName(accountNames);
    return;
  }

  if (command === 'accounts:deactivate-amazon-duplicates') {
    await deactivateAmazonDuplicateAccounts();
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
