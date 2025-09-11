import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  const email = 'ajarrar@trademanenterprise.com';
  const password = 'password123';
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Test User'
      }
    });
    
    console.log(`✅ Test user created successfully:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID: ${user.id}`);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();