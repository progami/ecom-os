export interface InventoryBatch {
  id: string;
  batchNumber: string;
  productId: string;
  quantity: number;
  remainingQty: number;
  unitCost: number;
  totalCost: number;
  manufactureDate: Date;
  expiryDate?: Date;
  receivedDate: Date;
  status: string;
  location?: string;
  supplier?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchAllocation {
  batchId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  date: Date;
  supplier: string;
  status: 'pending' | 'received' | 'cancelled';
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalAmount: number;
  receivedDate?: Date;
}

export interface BatchDetail {
  id: string;
  arrivalDate: Date | null;
  purchaseDate: Date;
  quantityRemaining: number;
  unitCosts: {
    manufacturing: number;
    freight: number;
    tariff: number;
    other: number;
  };
}

export interface BatchSummary {
  totalQuantity: number;
  averageCost: number;
  standardCost: number;
  variance: number;
}