import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Seed categorization rules for bookkeeping
  const rules = [
    {
      name: 'Office Supplies',
      description: 'Categorize office supply purchases',
      matchType: 'contains',
      matchField: 'description',
      matchValue: 'office supplies',
      accountCode: '400',
      taxType: 'BASEXCLUDED',
      priority: 10,
      isActive: true
    },
    {
      name: 'Software Subscriptions',
      description: 'Monthly software and SaaS subscriptions',
      matchType: 'contains',
      matchField: 'payee',
      matchValue: 'software',
      accountCode: '420',
      taxType: 'BASEXCLUDED',
      priority: 15,
      isActive: true
    },
    {
      name: 'Bank Fees',
      description: 'Bank service charges and fees',
      matchType: 'startsWith',
      matchField: 'description',
      matchValue: 'bank fee',
      accountCode: '404',
      taxType: 'EXEMPTEXPORT',
      priority: 20,
      isActive: true
    },
    {
      name: 'Shipping Costs',
      description: 'Outbound shipping and courier fees',
      matchType: 'contains',
      matchField: 'description',
      matchValue: 'shipping',
      accountCode: '425',
      taxType: 'BASEXCLUDED',
      priority: 5,
      isActive: true
    },
    {
      name: 'Travel Expenses',
      description: 'Business travel and accommodation',
      matchType: 'equals',
      matchField: 'reference',
      matchValue: 'TRAVEL',
      accountCode: '433',
      taxType: 'BASEXCLUDED',
      priority: 8,
      isActive: true
    }
  ];

  // Create categorization rules
  for (const rule of rules) {
    await prisma.categorizationRule.upsert({
      where: {
        id: rule.name.toLowerCase().replace(/\s+/g, '-')
      },
      update: rule,
      create: {
        id: rule.name.toLowerCase().replace(/\s+/g, '-'),
        ...rule
      }
    });
  }

  console.log(`✅ Created ${rules.length} categorization rules`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });