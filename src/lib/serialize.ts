import type {
  Product,
  Sale,
  Reservation,
  PreOrder,
  Category,
  ProductTemplate,
  StoreSettings,
  InventoryTransaction,
} from "@/lib/types";

// Prisma returns Decimal objects and Date objects; the front-end domain types
// use plain numbers and ISO strings. These mappers convert DB rows → the exact
// shapes the existing components already consume, so nothing downstream
// changes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iso(v: any): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString() : String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    barcode: p.barcode,
    description: p.description,
    costPrice: num(p.costPrice),
    unitPrice: num(p.unitPrice),
    stockQuantity: num(p.stockQuantity),
    reorderLevel: num(p.reorderLevel),
    deleted: p.deleted,
    templateId: p.templateId ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCategory(c: any): Category {
  return { id: c.id, name: c.name, prefix: c.prefix };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTemplate(t: any): ProductTemplate {
  return {
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    code: t.code,
    defaultCostPrice: num(t.defaultCostPrice),
    defaultUnitPrice: num(t.defaultUnitPrice),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSale(s: any): Sale {
  return {
    id: s.id,
    invoiceNumber: s.invoiceNumber ?? "",
    userId: s.userId,
    customerName: s.customerName,
    items: (s.items ?? []).map((it: any) => ({
      productId: it.productId,
      name: it.name,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      lineTotal: num(it.lineTotal),
    })),
    payments: (s.payments ?? []).map((p: any) => ({
      paymentType: p.paymentType,
      amount: num(p.amount),
    })),
    subtotal: num(s.subtotal),
    net: num(s.net),
    taxRate: num(s.taxRate),
    taxInclusive: s.taxInclusive,
    taxTotal: num(s.taxTotal),
    total: num(s.total),
    soldAt: iso(s.soldAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toReservation(r: any): Reservation {
  return {
    id: r.id,
    reference: r.reference,
    customerName: r.customerName,
    contactNumber: r.contactNumber,
    contactEmail: r.contactEmail,
    socialMedia: r.socialMedia,
    date: r.date,
    hours: r.hours ?? [],
    hourlyRate: num(r.hourlyRate),
    taxRate: num(r.taxRate),
    taxInclusive: r.taxInclusive,
    notes: r.notes,
    status: r.status,
    source: r.source ?? "IN_STORE",
    createdAt: iso(r.createdAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPreOrder(o: any): PreOrder {
  const lines = (o.lines ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((l: any) => ({
      productId: l.productId ?? null,
      name: l.name,
      unitPrice: num(l.unitPrice),
      quantity: num(l.quantity),
      received: l.received,
    }));
  return {
    id: o.id,
    reference: o.reference,
    clientName: o.clientName,
    contactNumber: o.contactNumber,
    contactEmail: o.contactEmail,
    socialMedia: o.socialMedia,
    expectedDate: o.expectedDate,
    lines,
    taxRate: num(o.taxRate),
    taxInclusive: o.taxInclusive,
    notes: o.notes,
    status: o.status,
    createdAt: iso(o.createdAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSettings(s: any): StoreSettings {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    address1: s.address1,
    address2: s.address2,
    tin: s.tin,
    phone: s.phone,
    email: s.email,
    website: s.website,
    businessReg: s.businessReg,
    receiptFooter: s.receiptFooter,
    invoicePrefix: s.invoicePrefix,
    defaultVatRate: num(s.defaultVatRate),
    vatInclusive: s.vatInclusive,
    repairWeekdayOpen: s.repairWeekdayOpen,
    repairWeekdayClose: s.repairWeekdayClose,
    repairWeekendOpen: s.repairWeekendOpen,
    repairWeekendClose: s.repairWeekendClose,
    repairHourlyRate: num(s.repairHourlyRate),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMovement(m: any): InventoryTransaction {
  return {
    id: m.id,
    productId: m.productId,
    userId: m.userId ?? null,
    reason: m.reason,
    quantityChange: num(m.quantityChange),
    comment: m.comment,
    saleId: m.saleId ?? null,
    createdAt: iso(m.createdAt),
  };
}
