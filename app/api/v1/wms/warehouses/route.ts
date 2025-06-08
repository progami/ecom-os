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

    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: {
          select: {
            inventoryLogs: true,
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
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
    const { code, name, address, contactEmail, contactPhone } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Check if warehouse code already exists
    const existing = await prisma.warehouse.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Warehouse code already exists' },
        { status: 409 }
      );
    }

    // Create new warehouse
    const warehouse = await prisma.warehouse.create({
      data: {
        code,
        name,
        address,
        contactEmail,
        contactPhone,
      },
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    );
  }
}