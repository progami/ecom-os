import { createLogger } from '@targon/logger';
import {
  createAccount,
  fetchAccounts,
  type QboAccount,
  type QboConnection,
} from './api';

const logger = createLogger({ name: 'plutus-qbo-lmb-plan' });

type CreateAccountInput = {
  name: string;
  accountType: string;
  accountSubType?: string;
  parentId?: string;
};

type EnsureResult = {
  created: QboAccount[];
  skipped: Array<{ name: string; parentName?: string }>;
  updatedConnection?: QboConnection;
};

type AccountTemplate = {
  accountType: string;
  accountSubType?: string;
};

function findAccountByName(accounts: QboAccount[], name: string): QboAccount | undefined {
  return accounts.find((a) => a.Name === name);
}

function requireAccountByName(accounts: QboAccount[], name: string): QboAccount {
  const found = findAccountByName(accounts, name);
  if (!found) {
    throw new Error(`Missing required QBO account "${name}" (create it first, then re-run).`);
  }
  return found;
}

function findSubAccountByParentId(
  accounts: QboAccount[],
  parentAccountId: string,
  name: string
): QboAccount | undefined {
  return accounts.find((a) => a.ParentRef?.value === parentAccountId && a.Name === name);
}

async function ensureParentAccount(
  connection: QboConnection,
  accounts: QboAccount[],
  input: CreateAccountInput
): Promise<{ account: QboAccount; created: boolean; updatedConnection?: QboConnection }> {
  const existing = findAccountByName(accounts, input.name);
  if (existing) {
    return { account: existing, created: false };
  }

  const { account, updatedConnection } = await createAccount(connection, input);
  accounts.push(account);
  return { account, created: true, updatedConnection };
}

async function ensureSubAccount(
  connection: QboConnection,
  accounts: QboAccount[],
  input: CreateAccountInput,
  parentName: string
): Promise<{ account?: QboAccount; created: boolean; updatedConnection?: QboConnection }> {
  if (!input.parentId) {
    throw new Error('ensureSubAccount requires parentId');
  }

  const existing = findSubAccountByParentId(accounts, input.parentId, input.name);
  if (existing) {
    return { account: existing, created: false };
  }

  logger.info('Creating sub-account in QBO', {
    parentName,
    name: input.name,
    accountType: input.accountType,
    accountSubType: input.accountSubType,
  });

  const { account, updatedConnection } = await createAccount(connection, input);
  accounts.push(account);
  return { account, created: true, updatedConnection };
}

function getTemplateFromAccount(account: QboAccount): AccountTemplate {
  return {
    accountType: account.AccountType,
    accountSubType: account.AccountSubType,
  };
}

export async function ensurePlutusQboLmbPlanAccounts(connection: QboConnection): Promise<EnsureResult> {
  let currentConnection = connection;

  const { accounts, updatedConnection: refreshedOnFetch } = await fetchAccounts(currentConnection);
  if (refreshedOnFetch) {
    currentConnection = refreshedOnFetch;
  }

  const created: QboAccount[] = [];
  const skipped: Array<{ name: string; parentName?: string }> = [];

  const inventoryAssetParent = requireAccountByName(accounts, 'Inventory Asset');
  const manufacturingParent = requireAccountByName(accounts, 'Manufacturing');
  const freightAndDutyParent = requireAccountByName(accounts, 'Freight & Custom Duty');
  const landFreightParent = requireAccountByName(accounts, 'Land Freight');
  const storage3plParent = requireAccountByName(accounts, 'Storage 3PL');

  const inventoryTemplate = getTemplateFromAccount(inventoryAssetParent);
  const manufacturingTemplate = getTemplateFromAccount(manufacturingParent);
  const freightAndDutyTemplate = getTemplateFromAccount(freightAndDutyParent);
  const landFreightTemplate = getTemplateFromAccount(landFreightParent);
  const storage3plTemplate = getTemplateFromAccount(storage3plParent);

  const amazonPromotionsParent = findAccountByName(accounts, 'Amazon Promotions');
  const shrinkageTemplate: AccountTemplate = {
    accountType: manufacturingTemplate.accountType,
    accountSubType: amazonPromotionsParent?.AccountSubType,
  };

  const {
    account: mfgAccessoriesParent,
    created: createdMfgAccessoriesParent,
    updatedConnection: updatedOnMfgAccessories,
  } =
    await ensureParentAccount(currentConnection, accounts, {
      name: 'Mfg Accessories',
      accountType: manufacturingTemplate.accountType,
      accountSubType: manufacturingTemplate.accountSubType,
    });
  if (updatedOnMfgAccessories) {
    currentConnection = updatedOnMfgAccessories;
  }

  if (createdMfgAccessoriesParent) {
    created.push(mfgAccessoriesParent);
  }

  const existingShrinkage = findAccountByName(accounts, 'Inventory Shrinkage');
  if (existingShrinkage) {
    skipped.push({ name: existingShrinkage.Name });
  } else {
    const { account: shrinkage, updatedConnection: updatedOnShrinkage } = await createAccount(currentConnection, {
      name: 'Inventory Shrinkage',
      accountType: shrinkageTemplate.accountType,
      accountSubType: shrinkageTemplate.accountSubType,
    });
    accounts.push(shrinkage);
    created.push(shrinkage);
    if (updatedOnShrinkage) {
      currentConnection = updatedOnShrinkage;
    }
  }

  const inventoryAssetSubAccounts = [
    'Manufacturing - US-Dust Sheets',
    'Manufacturing - UK-Dust Sheets',
    'Freight - US-Dust Sheets',
    'Freight - UK-Dust Sheets',
    'Duty - US-Dust Sheets',
    'Duty - UK-Dust Sheets',
    'Mfg Accessories - US-Dust Sheets',
    'Mfg Accessories - UK-Dust Sheets',
  ];

  for (const name of inventoryAssetSubAccounts) {
    const result = await ensureSubAccount(currentConnection, accounts, {
      name,
      accountType: inventoryTemplate.accountType,
      accountSubType: inventoryTemplate.accountSubType,
      parentId: inventoryAssetParent.Id,
    }, inventoryAssetParent.Name);

    if (result.created && result.account) {
      created.push(result.account);
    }

    if (!result.created) {
      skipped.push({ name, parentName: inventoryAssetParent.Name });
    }

    if (result.updatedConnection) {
      currentConnection = result.updatedConnection;
    }
  }

  const cogsSubAccounts: Array<{
    parent: QboAccount;
    template: AccountTemplate;
    names: string[];
  }> = [
    {
      parent: manufacturingParent,
      template: manufacturingTemplate,
      names: ['Manufacturing - US-Dust Sheets', 'Manufacturing - UK-Dust Sheets'],
    },
    {
      parent: freightAndDutyParent,
      template: freightAndDutyTemplate,
      names: [
        'Freight - US-Dust Sheets',
        'Freight - UK-Dust Sheets',
        'Duty - US-Dust Sheets',
        'Duty - UK-Dust Sheets',
      ],
    },
    {
      parent: landFreightParent,
      template: landFreightTemplate,
      names: ['Land Freight - US-Dust Sheets', 'Land Freight - UK-Dust Sheets'],
    },
    {
      parent: storage3plParent,
      template: storage3plTemplate,
      names: ['Storage 3PL - US-Dust Sheets', 'Storage 3PL - UK-Dust Sheets'],
    },
    {
      parent: mfgAccessoriesParent,
      template: getTemplateFromAccount(mfgAccessoriesParent),
      names: ['Mfg Accessories - US-Dust Sheets', 'Mfg Accessories - UK-Dust Sheets'],
    },
  ];

  for (const group of cogsSubAccounts) {
    for (const name of group.names) {
      const result = await ensureSubAccount(currentConnection, accounts, {
        name,
        accountType: group.template.accountType,
        accountSubType: group.template.accountSubType,
        parentId: group.parent.Id,
      }, group.parent.Name);

      if (result.created && result.account) {
        created.push(result.account);
      }

      if (!result.created) {
        skipped.push({ name, parentName: group.parent.Name });
      }

      if (result.updatedConnection) {
        currentConnection = result.updatedConnection;
      }
    }
  }

  return {
    created,
    skipped,
    updatedConnection: currentConnection === connection ? undefined : currentConnection,
  };
}
