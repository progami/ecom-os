import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// Helper function to create Decimal values
const dec = (value: number | string) => new Decimal(value)

async function createSampleSimulations() {
  console.log('🚀 Creating sample simulations...')
  
  try {
    // Get or create a default user
    let user = await prisma.user.findFirst({
      where: { email: 'demo@example.com' }
    })
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@example.com',
          name: 'Demo User',
          password: 'hashed_password_here', // In real app, this would be properly hashed
          role: 'STAFF'
        }
      })
      console.log('✅ Created demo user')
    }

    // Get sourcing profiles
    const sourcingProfiles = await prisma.sourcingProfile.findMany({
      take: 3
    })

    if (sourcingProfiles.length === 0) {
      console.log('❌ No sourcing profiles found. Please run seed-profiles.ts first.')
      return
    }

    // Sample simulation data
    const simulations = [
      {
        name: 'Premium Phone Case - High Margin',
        marketplace: 'US',
        targetSalePrice: dec(29.99),
        estimatedAcosPercent: dec(15),
        refundProvisionPercent: dec(2),
        sourcingProfileId: sourcingProfiles[0].id,
        components: {
          materials: [
            {
              name: 'Premium Silicone',
              costPerUnit: 2.00,
              costUnit: 'area',
              area: 0.01,
              totalCost: 0.20
            },
            {
              name: 'Packaging',
              costPerUnit: 1.00,
              costUnit: 'area',
              area: 0.005,
              totalCost: 0.05
            }
          ],
          dimensions: {
            length: 15,
            width: 8,
            height: 1,
            weight: 50
          }
        },
        results: {
          productCost: 4.50,
          shippingCost: 1.20,
          fbaFee: 3.20,
          referralFee: 2.40,
          totalCost: 11.30,
          netProfit: 18.69,
          netMarginPercent: 62.3,
          roi: 330.0,
          breakEven: true
        }
      },
      {
        name: 'Low-Price Kitchen Gadget',
        marketplace: 'US',
        targetSalePrice: dec(9.99),
        estimatedAcosPercent: dec(25),
        refundProvisionPercent: dec(3),
        sourcingProfileId: sourcingProfiles[1]?.id || sourcingProfiles[0].id,
        components: {
          materials: [
            {
              name: 'Recycled Plastic',
              costPerUnit: 0.80,
              costUnit: 'area',
              area: 0.015,
              totalCost: 0.12
            }
          ],
          dimensions: {
            length: 12,
            width: 8,
            height: 3,
            weight: 120
          }
        },
        results: {
          productCost: 2.50,
          shippingCost: 0.80,
          fbaFee: 2.51, // Low-price FBA fee
          referralFee: 1.50,
          totalCost: 7.31,
          netProfit: 2.68,
          netMarginPercent: 26.8,
          roi: 81.2,
          breakEven: true
        }
      },
      {
        name: 'Oversized Garden Tool',
        marketplace: 'US',
        targetSalePrice: dec(49.99),
        estimatedAcosPercent: dec(18),
        refundProvisionPercent: dec(4),
        sourcingProfileId: sourcingProfiles[2]?.id || sourcingProfiles[0].id,
        components: {
          materials: [
            {
              name: 'Steel Components',
              costPerArea: 0.005,
              area: 500,
              totalCost: 2.50
            },
            {
              name: 'Wooden Handle',
              costPerArea: 0.003,
              area: 200,
              totalCost: 0.60
            }
          ],
          dimensions: {
            length: 80,
            width: 30,
            height: 15,
            weight: 4500
          }
        },
        results: {
          productCost: 15.00,
          shippingCost: 5.50,
          fbaFee: 8.96, // Oversized fee
          referralFee: 7.50,
          totalCost: 36.96,
          netProfit: 13.03,
          netMarginPercent: 26.1,
          roi: 63.6,
          breakEven: true
        }
      },
      {
        name: 'Low Margin Electronics Accessory',
        marketplace: 'US',
        targetSalePrice: dec(7.99),
        estimatedAcosPercent: dec(35),
        refundProvisionPercent: dec(5),
        sourcingProfileId: sourcingProfiles[0].id,
        components: {
          materials: [
            {
              name: 'Generic Plastic',
              costPerArea: 0.0005,
              area: 80,
              totalCost: 0.04
            }
          ],
          dimensions: {
            length: 10,
            width: 5,
            height: 1,
            weight: 30
          }
        },
        results: {
          productCost: 2.00,
          shippingCost: 0.50,
          fbaFee: 3.20,
          referralFee: 1.20,
          totalCost: 6.90,
          netProfit: 1.09,
          netMarginPercent: 13.6,
          roi: 43.6,
          breakEven: true
        }
      },
      {
        name: 'Unprofitable Cheap Item',
        marketplace: 'US',
        targetSalePrice: dec(4.99),
        estimatedAcosPercent: dec(40),
        refundProvisionPercent: dec(8),
        sourcingProfileId: sourcingProfiles[0].id,
        components: {
          materials: [
            {
              name: 'Basic Material',
              costPerArea: 0.0003,
              area: 50,
              totalCost: 0.015
            }
          ],
          dimensions: {
            length: 8,
            width: 4,
            height: 1,
            weight: 20
          }
        },
        results: {
          productCost: 1.50,
          shippingCost: 0.30,
          fbaFee: 3.20,
          referralFee: 0.75,
          totalCost: 5.75,
          netProfit: -0.76,
          netMarginPercent: -15.2,
          roi: -42.2,
          breakEven: false
        }
      }
    ]

    // Create simulations
    for (const simData of simulations) {
      const simulation = await prisma.simulation.create({
        data: {
          userId: user.id,
          ...simData
        }
      })
      console.log(`✅ Created simulation: ${simulation.name}`)
    }

    console.log(`\n✨ Successfully created ${simulations.length} sample simulations!`)
    
    // Show summary
    const totalSimulations = await prisma.simulation.count()
    console.log(`\n📊 Total simulations in database: ${totalSimulations}`)

  } catch (error) {
    console.error('❌ Error creating simulations:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createSampleSimulations()