export interface InventoryItem {
  id?: string;
  unit?: string;
  costPrice?: number | null;
  lowStockThreshold?: number;
  version?: number;
  barcode: string;

  name: string;

  quantity: number;

  price: number;

  category?: string;

  imageUri?: string;
}

export interface BillItem {
  id: string;

  name: string;

  quantity: number;

  price: number;

  total: number;

  image?: string;

  discount?: number;

  tax?: number;
}

export interface Bill {
  currencyCode?: string;
  dueCents?: number;
  id: string;

  items: BillItem[];

  total: number;

  customerName: string;

  customerPhone?: string;

  timestamp: number;

  paymentMethod: string;

  subtotal?: number;

  discount?: number;

  tax?: number;
}
