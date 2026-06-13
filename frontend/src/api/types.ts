export interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

export interface Gs1Element {
  ai: string;
  name: string;
  value: string;
}

export interface Gs1Barcode {
  gtin: string | null;
  lot: string | null;
  serial: string | null;
  expiry: string | null; // ISO date
  productionDate: string | null;
  sscc: string | null;
  quantity: number | null;
  nhrn: string | null;
  elements: Gs1Element[];
  warnings: string[];
  raw: string;
}

export interface Product {
  id: number;
  gtin: string;
  name: string;
  strength: string | null;
  form: string | null;
  manufacturer: string | null;
  packSize: number | null;
}

export interface ScanResult {
  barcode: Gs1Barcode;
  product: Product | null;
  onHand: number;
}

export interface Lot {
  id: number;
  lot: string | null;
  expiry: string | null;
  quantity: number;
  updatedAt: string | null;
}

export interface InventoryRow {
  product: Product;
  lots: Lot[];
  totalOnHand: number;
}

export interface Transaction {
  id: number;
  type: "Receive" | "Dispense" | "CycleCount";
  gtin: string;
  productName: string | null;
  lot: string | null;
  serial: string | null;
  expiry: string | null;
  quantityDelta: number;
  resultingQuantity: number;
  userName: string;
  createdAt: string;
}

export interface MovementResponse {
  transaction: Transaction;
  onHand: number;
}

export type WorkflowMode = "receive" | "dispense" | "cycle-count";

export interface MovementRequest {
  gtin: string;
  lot?: string | null;
  serial?: string | null;
  expiry?: string | null;
  quantity: number;
  rawBarcode?: string | null;
  name?: string | null;
  strength?: string | null;
  form?: string | null;
  manufacturer?: string | null;
}
