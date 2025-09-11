const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'ajarrar@trademanenterprise.com' }
    });

    if (existingUser) {
      console.log('Test user already exists');
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'ajarrar@trademanenterprise.com',
        password: hashedPassword,
        name: 'TRADEMAN ENTERPRISE',
        tenantId: '!Qn7M1',
        tenantName: 'TRADEMAN ENTERPRISE LTD',
        hasCompletedSetup: true
      }
    });

    console.log('Test user created successfully:', user);
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();