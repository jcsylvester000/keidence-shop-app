// Front-end domain types. These mirror the Prisma models but use plain
// numbers (not Decimal) since the mock layer runs in the browser. When the
// DB is wired, API routes will map Prisma rows into these shapes.

export type UserRole = "ADMIN" | "MANAGER" | "CASHIER";

/** A managed product category. `prefix` seeds generated product codes. */
export interface Category {
  id: number;
  name: string;
  /** Short code used in generated barcodes, e.g. "DRV" → KEI-DRV-0001. */
  prefix: string;
}

/**
 * A reusable product definition. Many physical units share one template and
 * therefore one product code / barcode. Adding stock references a template so
 * name, category, and prices auto-fill and never need retyping.
 */
export interface ProductTemplate {
  id: number;
  name: string;
  categoryId: number;
  /** Canonical product code = the barcode printed on every unit. */
  code: string;
  defaultCostPrice: number;
  defaultUnitPrice: number;
}

/** Store & receipt details that print on receipts and invoices. */
export interface StoreSettings {
  storeName: string;
  tagline: string;
  address1: string;
  address2: string;
  tin: string; // Tax Identification Number
  phone: string;
  email: string;
  website: string;
  /** Optional business registration / permit numbers shown on invoices. */
  businessReg: string;
  /** Footer note printed at the bottom of receipts. */
  receiptFooter: string;
  /** Prefix for invoice numbers, e.g. "KEI". */
  invoicePrefix: string;
  /** Default VAT rate (percent) applied at the register. */
  defaultVatRate: number;
  /** Whether prices are VAT-inclusive by default. */
  vatInclusive: boolean;
  /** Repair space — weekday (Mon–Fri) opening hour (24h). */
  repairWeekdayOpen: number;
  /** Repair space — weekday (Mon–Fri) closing hour (24h). */
  repairWeekdayClose: number;
  /** Repair space — weekend (Sat–Sun) opening hour (24h). */
  repairWeekendOpen: number;
  /** Repair space — weekend (Sat–Sun) closing hour (24h). */
  repairWeekendClose: number;
  /** Repair space + tools rental rate per hour. */
  repairHourlyRate: number;
}

/** A booked repair-space + tools reservation. */
export interface Reservation {
  id: number;
  /** Booking reference, e.g. RES-20260718-0007. */
  reference: string;
  customerName: string;
  contactNumber: string;
  contactEmail: string;
  socialMedia: string;
  /** ISO date of the booking day, e.g. "2026-07-20". */
  date: string;
  /** Sorted list of booked start hours (24h). Each covers one hour. */
  hours: number[];
  hourlyRate: number;
  /** VAT rate applied to the booking (percent). */
  taxRate: number;
  taxInclusive: boolean;
  notes: string;
  status: "BOOKED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

/** One line on a pre-order — sourced-to-order, not from current stock. */
export interface PreOrderLine {
  productId: number | null;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Marked true when the item has been obtained from the vendor/warehouse. */
  received: boolean;
}

/**
 * A client's pre-order (batch sale). The shop sources these items from a
 * warehouse/vendor, marks each line received as it arrives, then the whole
 * order becomes Ready for Pickup and finally Completed.
 */
export interface PreOrder {
  id: number;
  /** Reference, e.g. PO-20260720-0003. */
  reference: string;
  clientName: string;
  contactNumber: string;
  contactEmail: string;
  socialMedia: string;
  /** ISO expected pickup / target date. Up to ~20 orders share a date. */
  expectedDate: string;
  lines: PreOrderLine[];
  taxRate: number;
  taxInclusive: boolean;
  notes: string;
  /**
   * PENDING  = order taken, nothing sourced yet
   * ORDERING = some but not all items received
   * READY    = all items received, awaiting client pickup
   * COMPLETED= client picked up / paid
   * CANCELLED
   */
  status: "PENDING" | "ORDERING" | "READY" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export interface SessionUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  barcode: string | null;
  description: string;
  costPrice: number;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  deleted: boolean;
  /** Optional link to the ProductTemplate this stock was created from. */
  templateId?: number | null;
}

export type InventoryReason =
  | "SALE"
  | "RESTOCK"
  | "ADJUSTMENT"
  | "RETURN"
  | "INITIAL";

export interface InventoryTransaction {
  id: number;
  productId: number;
  userId: number | null;
  reason: InventoryReason;
  quantityChange: number;
  comment: string;
  saleId: number | null;
  createdAt: string;
}

export interface CartLine {
  productId: number;
  name: string;
  barcode: string | null;
  unitPrice: number;
  quantity: number;
  stockQuantity: number;
}

export interface SalePayment {
  paymentType: string;
  amount: number;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  userId: number;
  customerName: string;
  items: {
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payments: SalePayment[];
  /** Sum of line items as entered. */
  subtotal: number;
  /** Net-of-VAT portion. */
  net: number;
  /** VAT rate applied, in percent. */
  taxRate: number;
  /** Whether prices were VAT-inclusive. */
  taxInclusive: boolean;
  /** VAT amount. */
  taxTotal: number;
  /** Grand total the customer paid. */
  total: number;
  soldAt: string;
}
