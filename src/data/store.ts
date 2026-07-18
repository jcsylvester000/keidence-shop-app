"use client";

// ---------------------------------------------------------------------------
// Client-side data store, backed by the Postgres API.
//
// Design goal: keep EVERY exported function signature identical to the old
// mock so the 8 pages don't change. Reads are synchronous against an in-memory
// cache that hydrates from /api/bootstrap once after login. Mutations call the
// matching API route and update the cache (optimistically), then emit so
// useStore selectors re-render. Cached selectors keep stable references.
// ---------------------------------------------------------------------------

import type {
  Product,
  Sale,
  CartLine,
  SalePayment,
  InventoryTransaction,
  StoreSettings,
  Category,
  ProductTemplate,
  Reservation,
  PreOrder,
  PreOrderLine,
} from "@/lib/types";
import { computeVat, DEFAULT_VAT_RATE } from "@/lib/utils";

// ---- Default settings (used until hydration completes) --------------------

export const defaultStoreSettings: StoreSettings = {
  storeName: "Keidence Bike Shop",
  tagline: "Bikes • Parts • Hobbies",
  address1: "123 Rizal Avenue",
  address2: "Quezon City, Metro Manila",
  tin: "000-000-000-000",
  phone: "(02) 8000-0000",
  email: "hello@keidence.ph",
  website: "www.keidence.ph",
  businessReg: "",
  receiptFooter: "Thank you for shopping with Keidence!",
  invoicePrefix: "KEI",
  defaultVatRate: DEFAULT_VAT_RATE,
  vatInclusive: true,
  repairWeekdayOpen: 10,
  repairWeekdayClose: 19,
  repairWeekendOpen: 10,
  repairWeekendClose: 19,
  repairHourlyRate: 150,
};

// ---- Cache ----------------------------------------------------------------

interface Cache {
  products: Product[];
  sales: Sale[];
  settings: StoreSettings;
  categories: Category[];
  templates: ProductTemplate[];
  reservations: Reservation[];
  preOrders: PreOrder[];
  hydrated: boolean;
}

const g = globalThis as unknown as { __keidenceCache?: Cache };

function cache(): Cache {
  if (!g.__keidenceCache) {
    g.__keidenceCache = {
      products: [],
      sales: [],
      settings: { ...defaultStoreSettings },
      categories: [],
      templates: [],
      reservations: [],
      preOrders: [],
      hydrated: false,
    };
  }
  return g.__keidenceCache;
}

// ---- pub/sub + version-keyed memoization ----------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function getVersion(): number {
  return version;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  version++;
  listeners.forEach((fn) => fn());
}

function cached<T>(compute: () => T): () => T {
  let cachedVersion = -1;
  let cachedValue: T;
  return () => {
    if (cachedVersion !== version) {
      cachedValue = compute();
      cachedVersion = version;
    }
    return cachedValue;
  };
}

// ---- Hydration ------------------------------------------------------------

let hydrating: Promise<void> | null = null;

/** Load the full app state from the API. Called once after login. */
export async function hydrateStore(force = false): Promise<void> {
  if (hydrating) return hydrating;
  if (cache().hydrated && !force) return;
  hydrating = (async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const c = cache();
      c.products = data.products ?? [];
      c.categories = data.categories ?? [];
      c.templates = data.templates ?? [];
      c.sales = data.sales ?? [];
      c.reservations = data.reservations ?? [];
      c.preOrders = data.preOrders ?? [];
      c.settings = data.settings ?? { ...defaultStoreSettings };
      c.hydrated = true;
      emit();
    } finally {
      hydrating = null;
    }
  })();
  return hydrating;
}

export function isHydrated(): boolean {
  return cache().hydrated;
}

async function api(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ---- Auth -----------------------------------------------------------------

// Kept for API compatibility; real auth goes through /api/auth in the session
// provider. Returns null (login handled server-side now).
export function authenticate(): null {
  return null;
}

// ---- Settings -------------------------------------------------------------

export const getSettings = cached((): StoreSettings => ({ ...cache().settings }));

export function updateSettings(patch: Partial<StoreSettings>): StoreSettings {
  const c = cache();
  c.settings = { ...c.settings, ...patch };
  emit();
  api("/api/settings", patch).catch(() => hydrateStore(true));
  return { ...c.settings };
}

// ---- Categories -----------------------------------------------------------

export const getCategories = cached((): Category[] =>
  cache().categories.slice().sort((a, b) => a.name.localeCompare(b.name))
);

export function getCategory(id: number): Category | undefined {
  return cache().categories.find((c) => c.id === id);
}

export function upsertCategory(
  input: Omit<Category, "id"> & { id?: number }
): Category {
  const c = cache();
  const optimistic: Category = {
    id: input.id ?? -Date.now(),
    name: input.name,
    prefix: (input.prefix || input.name.slice(0, 3)).toUpperCase().slice(0, 4),
  };
  if (input.id) {
    const idx = c.categories.findIndex((x) => x.id === input.id);
    if (idx >= 0) c.categories[idx] = optimistic;
  } else {
    c.categories.push(optimistic);
  }
  emit();
  api("/api/categories", input)
    .then((r) => {
      if (r?.category) {
        const idx = c.categories.findIndex(
          (x) => x.id === (input.id ?? optimistic.id)
        );
        if (idx >= 0) c.categories[idx] = r.category;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
  return optimistic;
}

export function deleteCategory(id: number): void {
  const c = cache();
  c.categories = c.categories.filter((x) => x.id !== id);
  emit();
  api(`/api/categories?id=${id}`, undefined, "DELETE").catch(() =>
    hydrateStore(true)
  );
}

// ---- Product templates ----------------------------------------------------

export const getTemplates = cached((): ProductTemplate[] =>
  cache().templates.slice().sort((a, b) => a.name.localeCompare(b.name))
);

export function getTemplate(id: number): ProductTemplate | undefined {
  return cache().templates.find((t) => t.id === id);
}

export function getTemplateByCode(code: string): ProductTemplate | undefined {
  const q = code.trim();
  if (!q) return undefined;
  return cache().templates.find((t) => t.code === q);
}

/** Preview code (real code is assigned server-side on save). */
export function generateProductCode(categoryId: number): string {
  const cat = cache().categories.find((c) => c.id === categoryId);
  const prefix = cat?.prefix || "GEN";
  return `KEI-${prefix}-####`;
}

export function upsertTemplate(
  input: Omit<ProductTemplate, "id" | "code"> & { id?: number; code?: string }
): ProductTemplate {
  const c = cache();
  const optimistic: ProductTemplate = {
    id: input.id ?? -Date.now(),
    name: input.name,
    categoryId: input.categoryId,
    code: input.code || generateProductCode(input.categoryId),
    defaultCostPrice: input.defaultCostPrice,
    defaultUnitPrice: input.defaultUnitPrice,
  };
  if (input.id) {
    const idx = c.templates.findIndex((x) => x.id === input.id);
    if (idx >= 0) c.templates[idx] = optimistic;
  } else {
    c.templates.push(optimistic);
  }
  emit();
  api("/api/templates", input)
    .then((r) => {
      if (r?.template) {
        const idx = c.templates.findIndex(
          (x) => x.id === (input.id ?? optimistic.id)
        );
        if (idx >= 0) c.templates[idx] = r.template;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
  return optimistic;
}

export function deleteTemplate(id: number): void {
  const c = cache();
  c.templates = c.templates.filter((x) => x.id !== id);
  emit();
  api(`/api/templates?id=${id}`, undefined, "DELETE").catch(() =>
    hydrateStore(true)
  );
}

// ---- Reservations ---------------------------------------------------------

export const getReservations = cached((): Reservation[] =>
  cache()
    .reservations.slice()
    .sort((a, b) =>
      a.date === b.date
        ? (a.hours[0] ?? 0) - (b.hours[0] ?? 0)
        : a.date < b.date
          ? -1
          : 1
    )
);

export function getReservationsForDate(date: string): Reservation[] {
  return cache().reservations.filter(
    (r) => r.date === date && r.status !== "CANCELLED"
  );
}

export function getBookedHours(date: string): Map<number, Reservation> {
  const map = new Map<number, Reservation>();
  for (const r of getReservationsForDate(date)) {
    for (const h of r.hours) map.set(h, r);
  }
  return map;
}

/**
 * Create a reservation. Returns null if a slot is already booked locally.
 * The server also enforces this; on a server conflict we re-hydrate.
 */
export function createReservation(input: {
  customerName: string;
  contactNumber: string;
  contactEmail: string;
  socialMedia: string;
  date: string;
  hours: number[];
  hourlyRate: number;
  taxRate: number;
  taxInclusive: boolean;
  notes: string;
}): Reservation | null {
  const taken = getBookedHours(input.date);
  if (input.hours.some((h) => taken.has(h))) return null;

  const c = cache();
  const optimistic: Reservation = {
    id: -Date.now(),
    reference: "…",
    ...input,
    hours: [...input.hours].sort((a, b) => a - b),
    status: "BOOKED",
    createdAt: new Date().toISOString(),
  };
  c.reservations.push(optimistic);
  emit();
  api("/api/reservations", input)
    .then((r) => {
      if (r?.reservation) {
        const idx = c.reservations.findIndex((x) => x.id === optimistic.id);
        if (idx >= 0) c.reservations[idx] = r.reservation;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
  return optimistic;
}

export function updateReservationStatus(
  id: number,
  status: Reservation["status"]
): void {
  const c = cache();
  const r = c.reservations.find((x) => x.id === id);
  if (r) {
    r.status = status;
    emit();
  }
  api("/api/reservations/status", { id, status }).catch(() =>
    hydrateStore(true)
  );
}

export function deleteReservation(id: number): void {
  const c = cache();
  c.reservations = c.reservations.filter((r) => r.id !== id);
  emit();
  api(`/api/reservations?id=${id}`, undefined, "DELETE").catch(() =>
    hydrateStore(true)
  );
}

// ---- Pre-orders (batch sales) ---------------------------------------------

export const getPreOrders = cached((): PreOrder[] =>
  cache()
    .preOrders.slice()
    .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))
);

// Must be cached() because it's consumed via useStore — an un-memoized
// .filter() would return a new array each render and trigger an infinite loop
// (React error #185 / "getSnapshot should be cached").
export const getActivePreOrders = cached((): PreOrder[] =>
  getPreOrders().filter((p) => p.status !== "CANCELLED")
);

function derive(order: PreOrder): PreOrder["status"] {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return order.status;
  }
  const total = order.lines.length;
  if (total === 0) return "PENDING";
  const received = order.lines.filter((l) => l.received).length;
  if (received === 0) return "PENDING";
  if (received < total) return "ORDERING";
  return "READY";
}

export function createPreOrder(input: {
  clientName: string;
  contactNumber: string;
  contactEmail: string;
  socialMedia: string;
  expectedDate: string;
  lines: PreOrderLine[];
  taxRate: number;
  taxInclusive: boolean;
  notes: string;
}): PreOrder {
  const c = cache();
  const optimistic: PreOrder = {
    id: -Date.now(),
    reference: "…",
    ...input,
    lines: input.lines.map((l) => ({ ...l, received: false })),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  c.preOrders.push(optimistic);
  emit();
  api("/api/preorders", input)
    .then((r) => {
      if (r?.preOrder) {
        const idx = c.preOrders.findIndex((x) => x.id === optimistic.id);
        if (idx >= 0) c.preOrders[idx] = r.preOrder;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
  return optimistic;
}

export function setPreOrderLineReceived(
  orderId: number,
  lineIndex: number,
  received: boolean
): void {
  const c = cache();
  const order = c.preOrders.find((p) => p.id === orderId);
  if (order && order.lines[lineIndex]) {
    order.lines[lineIndex].received = received;
    order.status = derive(order);
    emit();
  }
  api("/api/preorders/line", { orderId, lineIndex, received })
    .then((r) => {
      if (r?.preOrder) {
        const idx = c.preOrders.findIndex((x) => x.id === orderId);
        if (idx >= 0) c.preOrders[idx] = r.preOrder;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
}

export function setPreOrderStatus(
  orderId: number,
  status: PreOrder["status"]
): void {
  const c = cache();
  const order = c.preOrders.find((p) => p.id === orderId);
  if (order) {
    order.status = status;
    if (status !== "COMPLETED" && status !== "CANCELLED") {
      order.status = derive(order);
    }
    emit();
  }
  api("/api/preorders/status", { id: orderId, status }).catch(() =>
    hydrateStore(true)
  );
}

export function deletePreOrder(id: number): void {
  const c = cache();
  c.preOrders = c.preOrders.filter((p) => p.id !== id);
  emit();
  api(`/api/preorders?id=${id}`, undefined, "DELETE").catch(() =>
    hydrateStore(true)
  );
}

export interface ProcurementItem {
  productId: number | null;
  name: string;
  unitPrice: number;
  totalQty: number;
  receivedQty: number;
  clients: {
    orderId: number;
    reference: string;
    clientName: string;
    lineIndex: number;
    quantity: number;
    received: boolean;
  }[];
}

export function getProcurement(dateFilter?: string): ProcurementItem[] {
  const orders = cache().preOrders.filter(
    (p) =>
      p.status !== "CANCELLED" &&
      p.status !== "COMPLETED" &&
      (!dateFilter || p.expectedDate === dateFilter)
  );
  const map = new Map<string, ProcurementItem>();
  for (const order of orders) {
    order.lines.forEach((line, lineIndex) => {
      const key =
        line.productId != null
          ? `p${line.productId}`
          : `n${line.name.toLowerCase()}`;
      let item = map.get(key);
      if (!item) {
        item = {
          productId: line.productId,
          name: line.name,
          unitPrice: line.unitPrice,
          totalQty: 0,
          receivedQty: 0,
          clients: [],
        };
        map.set(key, item);
      }
      item.totalQty += line.quantity;
      if (line.received) item.receivedQty += line.quantity;
      item.clients.push({
        orderId: order.id,
        reference: order.reference,
        clientName: order.clientName,
        lineIndex,
        quantity: line.quantity,
        received: line.received,
      });
    });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getPreOrderDates(): string[] {
  const set = new Set<string>();
  for (const p of cache().preOrders) {
    if (p.status !== "CANCELLED") set.add(p.expectedDate);
  }
  return Array.from(set).sort();
}

// ---- Products -------------------------------------------------------------

export const getProducts = cached((): Product[] =>
  cache().products.filter((p) => !p.deleted)
);

export function getProduct(id: number): Product | undefined {
  return cache().products.find((p) => p.id === id && !p.deleted);
}

export function findByBarcode(code: string): Product | undefined {
  const q = code.trim();
  if (!q) return undefined;
  return cache().products.find(
    (p) => !p.deleted && (p.barcode === q || String(p.id) === q)
  );
}

export function upsertProduct(
  input: Omit<Product, "id" | "deleted"> & { id?: number }
): Product {
  const c = cache();
  const optimistic: Product = {
    ...input,
    id: input.id ?? -Date.now(),
    deleted: false,
  };
  if (input.id) {
    const idx = c.products.findIndex((p) => p.id === input.id);
    if (idx >= 0) c.products[idx] = { ...c.products[idx], ...optimistic };
  } else {
    c.products.push(optimistic);
  }
  emit();
  api("/api/products", input)
    .then((r) => {
      if (r?.product) {
        const idx = c.products.findIndex(
          (p) => p.id === (input.id ?? optimistic.id)
        );
        if (idx >= 0) c.products[idx] = r.product;
        emit();
      }
    })
    .catch(() => hydrateStore(true));
  return optimistic;
}

export function deleteProduct(id: number): void {
  const c = cache();
  const p = c.products.find((x) => x.id === id);
  if (p) {
    p.deleted = true;
    emit();
  }
  api(`/api/products?id=${id}`, undefined, "DELETE").catch(() =>
    hydrateStore(true)
  );
}

export function adjustStock(
  productId: number,
  delta: number,
  comment: string
): void {
  const p = getProduct(productId);
  if (p) {
    p.stockQuantity += delta;
    emit();
  }
  api("/api/products/adjust", { productId, delta, comment }).catch(() =>
    hydrateStore(true)
  );
}

/** Movements aren't cached client-side; fetched on demand where shown. */
export function getMovementsForProduct(): InventoryTransaction[] {
  return [];
}

// ---- Sales ----------------------------------------------------------------

export const getSales = cached((): Sale[] =>
  cache().sales.slice().sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1))
);

/**
 * Complete a sale. Optimistically inserts the sale + decrements stock, then
 * calls the API and reconciles with the server's authoritative record.
 */
export function completeSale(params: {
  userId: number;
  customerName: string;
  lines: CartLine[];
  payments: SalePayment[];
  taxRate?: number;
  taxInclusive?: boolean;
}): Sale {
  const c = cache();
  const subtotal = params.lines.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0
  );
  const rate = params.taxRate ?? c.settings.defaultVatRate;
  const inclusive = params.taxInclusive ?? c.settings.vatInclusive;
  const vat = computeVat(subtotal, rate, inclusive);

  const optimistic: Sale = {
    id: -Date.now(),
    invoiceNumber: "…",
    userId: params.userId,
    customerName: params.customerName,
    items: params.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.unitPrice * l.quantity,
    })),
    payments: params.payments,
    subtotal,
    net: vat.net,
    taxRate: rate,
    taxInclusive: inclusive,
    taxTotal: vat.vat,
    total: vat.grandTotal,
    soldAt: new Date().toISOString(),
  };
  c.sales.push(optimistic);
  // Optimistic stock decrement.
  for (const line of params.lines) {
    const p = c.products.find((x) => x.id === line.productId);
    if (p) p.stockQuantity -= line.quantity;
  }
  emit();

  api("/api/sales", {
    customerName: params.customerName,
    lines: params.lines,
    payments: params.payments,
    taxRate: rate,
    taxInclusive: inclusive,
  })
    .then((r) => {
      if (r?.sale) {
        const idx = c.sales.findIndex((x) => x.id === optimistic.id);
        if (idx >= 0) c.sales[idx] = r.sale;
        emit();
      }
    })
    .catch(() => hydrateStore(true));

  return optimistic;
}

// ---- Dashboard helpers ----------------------------------------------------

export const getLowStockProducts = cached((): Product[] =>
  cache().products.filter(
    (p) => !p.deleted && p.stockQuantity <= p.reorderLevel
  )
);
