import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSampleSkus() {
  try {
    console.log('Creating sample SKUs with dimensional and weight data...\n');

    const sampleSkus = [
      {
        skuCode: 'SKU001',
        asin: 'B07XYZ123',
        description: 'Premium Widget - Small',
        packSize: 12,
        material: 'Plastic',
        unitDimensionsCm: '10x8x5',
        unitWeightKg: 0.25,
        unitsPerCarton: 24,
        cartonDimensionsCm: '40x30x25',
        cartonWeightKg: 6.5,
        packagingType: 'Box',
        notes: 'Handle with care'
      },
      {
        skuCode: 'SKU002',
        asin: 'B08ABC456',
        description: 'Deluxe Gadget - Medium',
        packSize: 6,
        material: 'Metal',
        unitDimensionsCm: '15x12x8',
        unitWeightKg: 0.75,
        unitsPerCarton: 12,
        cartonDimensionsCm: '45x35x30',
        cartonWeightKg: 9.5,
        packagingType: 'Carton',
        notes: 'Fragile item'
      },
      {
        skuCode: 'SKU003',
        asin: null, // No ASIN
        description: 'Basic Component',
        packSize: 100,
        material: 'Aluminum',
        unitDimensionsCm: '5x3x2',
        unitWeightKg: 0.05,
        unitsPerCarton: 500,
        cartonDimensionsCm: '30x25x20',
        cartonWeightKg: 26.0,
        packagingType: 'Bulk',
        notes: null
      },
      {
        skuCode: 'SKU004',
        asin: 'B09DEF789',
        description: 'Heavy Equipment Part',
        packSize: 1,
        material: 'Steel',
        unitDimensionsCm: null, // Missing dimensions
        unitWeightKg: 2.5,
        unitsPerCarton: 4,
        cartonDimensionsCm: null, // Missing dimensions
        cartonWeightKg: 10.5,
        packagingType: 'Pallet',
        notes: 'Requires forklift'
      },
      {
        skuCode: 'SKU005',
        asin: 'B10GHI012',
        description: 'Light Accessory',
        packSize: 50,
        material: 'Fabric',
        unitDimensionsCm: '20x15x2',
        unitWeightKg: null, // Missing weight
        unitsPerCarton: 200,
        cartonDimensionsCm: '60x40x30',
        cartonWeightKg: null, // Missing weight
        packagingType: 'Bag',
        notes: 'Keep dry'
      },
      {
        skuCode: 'SKU006',
        asin: null,
        description: 'Standard Item - No Specs',
        packSize: 10,
        material: null,
        unitDimensionsCm: null, // No dimensions
        unitWeightKg: null, // No weight
        unitsPerCarton: 50,
        cartonDimensionsCm: null, // No dimensions
        cartonWeightKg: null, // No weight
        packagingType: null,
        notes: 'Dimensional data not available'
      }
    ];

    for (const skuData of sampleSkus) {
      const sku = await prisma.sku.create({
        data: skuData
      });
      console.log(`Created SKU: ${sku.skuCode} - ${sku.description}`);
    }

    // Now run the check script results
    console.log('\n--- Running SKU Data Analysis ---');
    
    // 1. Get total SKUs count
    const totalSkus = await prisma.sku.count();
    console.log(`\n1. Total SKUs in database: ${totalSkus}`);

    // 2. Count SKUs with ASIN values
    const skusWithAsin = await prisma.sku.count({
      where: {
        asin: {
          not: null
        }
      }
    });
    console.log(`\n2. SKUs with ASIN values: ${skusWithAsin}`);

    // 3. Count SKUs with weight data
    const skusWithUnitWeight = await prisma.sku.count({
      where: {
        unitWeightKg: {
          not: null
        }
      }
    });
    
    const skusWithCartonWeight = await prisma.sku.count({
      where: {
        cartonWeightKg: {
          not: null
        }
      }
    });
    
    console.log(`\n3. SKUs with weight data:`);
    console.log(`   - With unitWeightKg: ${skusWithUnitWeight}`);
    console.log(`   - With cartonWeightKg: ${skusWithCartonWeight}`);

    // 4. Count SKUs with dimension data
    const skusWithUnitDimensions = await prisma.sku.count({
      where: {
        unitDimensionsCm: {
          not: null
        }
      }
    });
    
    const skusWithCartonDimensions = await prisma.sku.count({
      where: {
        cartonDimensionsCm: {
          not: null
        }
      }
    });
    
    console.log(`\n4. SKUs with dimension data:`);
    console.log(`   - With unitDimensionsCm: ${skusWithUnitDimensions}`);
    console.log(`   - With cartonDimensionsCm: ${skusWithCartonDimensions}`);

    // 5. Get sample records
    console.log(`\n5. Sample SKU records:`);
    console.log('-------------------------');
    
    const sampleSkusFromDb = await prisma.sku.findMany({
      orderBy: {
        skuCode: 'asc'
      }
    });

    for (const sku of sampleSkusFromDb) {
      console.log(`\nSKU Code: ${sku.skuCode}`);
      console.log(`Description: ${sku.description}`);
      console.log(`ASIN: ${sku.asin || 'NULL'}`);
      console.log(`Pack Size: ${sku.packSize}`);
      console.log(`Units Per Carton: ${sku.unitsPerCarton}`);
      console.log(`Unit Weight (kg): ${sku.unitWeightKg || 'NULL'}`);
      console.log(`Carton Weight (kg): ${sku.cartonWeightKg || 'NULL'}`);
      console.log(`Unit Dimensions (cm): ${sku.unitDimensionsCm || 'NULL'}`);
      console.log(`Carton Dimensions (cm): ${sku.cartonDimensionsCm || 'NULL'}`);
      console.log(`Material: ${sku.material || 'NULL'}`);
      console.log(`Packaging Type: ${sku.packagingType || 'NULL'}`);
      console.log('---');
    }

    // Additional: Show SKUs that have both weight and dimensions
    const fullyPopulatedSkus = await prisma.sku.count({
      where: {
        AND: [
          { unitWeightKg: { not: null } },
          { cartonWeightKg: { not: null } },
          { unitDimensionsCm: { not: null } },
          { cartonDimensionsCm: { not: null } }
        ]
      }
    });
    
    console.log(`\n6. SKUs with BOTH weight AND dimension data: ${fullyPopulatedSkus}`);

    console.log('\n✅ Sample SKUs created successfully!');
  } catch (error) {
    console.error('Error creating sample SKUs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleSkus();