import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const productId = searchParams.get('productId');
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    // Build query filters
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (productId) where.productId = productId;

    // Fetch inventory data
    const inventory = await prisma.wmsInventoryBalance.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        lastUpdated: 'desc',
      },
    });

    // Filter for low stock if requested
    let items = inventory;
    if (lowStockOnly) {
      const threshold = parseInt(process.env.LOW_STOCK_THRESHOLD || '100');
      items = inventory.filter(item => item.quantity < threshold);
    }

    // Transform data for API response
    const response = {
      items: items.map(item => ({
        id: item.id,
        warehouseId: item.warehouseId,
        warehouseCode: item.warehouse.code,
        warehouseName: item.warehouse.name,
        productId: item.productId,
        sku: item.product.sku,
        productName: item.product.name,
        description: item.product.description,
        quantity: item.quantity,
        unit: item.unit,
        lastUpdated: item.lastUpdated,
        batchLot: item.batchLot || '',
        currentUnits: item.quantity,
        currentCartons: Math.floor(item.quantity / (item.unitsPerCarton || 1)),
      })),
      total: items.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { warehouseId, productId, quantity, unit, batchLot, type, notes } = body;

    // Validate required fields
    if (!warehouseId || !productId || quantity === undefined || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create inventory log entry
    const inventoryLog = await prisma.wmsInventoryTransaction.create({
      data: {
        warehouseId,
        productId,
        quantity,
        unit: unit || 'units',
        batchLot,
        type,
        notes,
        userId: (session.user as any).id,
      },
      include: {
        warehouse: true,
        product: true,
      },
    });

    return NextResponse.json(inventoryLog, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory log:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory log' },
      { status: 500 }
    );
  }
}