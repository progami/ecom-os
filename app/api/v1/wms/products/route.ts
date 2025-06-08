import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      include: {
        inventoryLogs: {
          select: {
            warehouseId: true,
            quantity: true,
            unit: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        _count: {
          select: {
            inventoryLogs: true,
          },
        },
      },
      orderBy: {
        sku: 'asc',
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
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
    const { sku, name, description, category, unitPrice, weight, dimensions } = body;

    // Validate required fields
    if (!sku || !name) {
      return NextResponse.json(
        { error: 'SKU and name are required' },
        { status: 400 }
      );
    }

    // Check if SKU already exists
    const existing = await prisma.product.findUnique({
      where: { sku },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Product SKU already exists' },
        { status: 409 }
      );
    }

    // Create new product
    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        category,
        unitPrice,
        weight,
        dimensions,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}