"use client";

// ---------------------------------------------------------------------------
// Mock in-memory data layer.
//
// This lets the entire front-end be built and clicked through before Neon /
// Prisma is wired up. Every function here has the same *shape* it will have
// when it becomes a real API call, so swapping to the database later is a
// matter of replacing the bodies, not the call sites.
//
// A tiny pub/sub lets React components re-render when the shared store
// changes (e.g. a sale decrements stock and the inventory page updates).
// ---------------------------------------------------------------------------

import type {
  Product,
  Sale,
  CartLine,
  SalePayment,
  InventoryTransaction,
  SessionUser,
  StoreSettings,
  Category,
  ProductTemplate,
  Reservation,
  PreOrder,
  PreOrderLine,
} from "@/lib/types";
import { makeInvoiceNumber, computeVat, DEFAULT_VAT_RATE } from "@/lib/utils";

// ---- Store & receipt settings (persisted) ---------------------------------

const SETTINGS_KEY = "keidence.storeSettings";

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

function loadSettings(): StoreSettings {
  if (typeof window === "undefined") return { ...defaultStoreSettings };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultStoreSettings, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultStoreSettings };
}

function persistSettings(s: StoreSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---- Seed data ------------------------------------------------------------

const seedProducts: Product[] = [
  // Keidence Bike shop
  { id: 1, name: "Shimano Deore XT Rear Derailleur", category: "Drivetrain", barcode: "4550170123456", description: "12-speed rear derailleur", costPrice: 4200, unitPrice: 6500, stockQuantity: 8, reorderLevel: 3, deleted: false },
  { id: 2, name: "Continental GP5000 Tire 700x25", category: "Tires", barcode: "4019238012345", description: "Clincher road tire", costPrice: 1800, unitPrice: 2950, stockQuantity: 24, reorderLevel: 10, deleted: false },
  { id: 3, name: "Maxxis Minion DHF 29x2.5", category: "Tires", barcode: "4717784021102", description: "MTB front tire", costPrice: 1650, unitPrice: 2700, stockQuantity: 5, reorderLevel: 6, deleted: false },
  { id: 4, name: "SRAM PC-1110 Chain 11sp", category: "Drivetrain", barcode: "710845778001", description: "11-speed chain", costPrice: 950, unitPrice: 1650, stockQuantity: 30, reorderLevel: 8, deleted: false },
  { id: 5, name: "Bontrager Aeolus Helmet M", category: "Accessories", barcode: "601842567890", description: "Road helmet, medium", costPrice: 3200, unitPrice: 5200, stockQuantity: 12, reorderLevel: 4, deleted: false },
  { id: 6, name: "Fizik Antares Saddle", category: "Components", barcode: "8021890412345", description: "Road saddle", costPrice: 2400, unitPrice: 3900, stockQuantity: 2, reorderLevel: 3, deleted: false },
  { id: 7, name: "Muc-Off Bike Cleaner 1L", category: "Care", barcode: "5037835904048", description: "Biodegradable cleaner", costPrice: 320, unitPrice: 590, stockQuantity: 40, reorderLevel: 12, deleted: false },
  { id: 8, name: "CatEye Volt 800 Headlight", category: "Accessories", barcode: "4990173028931", description: "USB rechargeable light", costPrice: 2100, unitPrice: 3450, stockQuantity: 9, reorderLevel: 4, deleted: false },

  // AMP Hobbies
  { id: 9, name: "Tamiya TT-02 Chassis Kit", category: "RC Kits", barcode: "4950344583850", description: "1/10 RC touring car kit", costPrice: 3600, unitPrice: 5400, stockQuantity: 6, reorderLevel: 3, deleted: false },
  { id: 10, name: "Gunpla RG Nu Gundam", category: "Model Kits", barcode: "4573102621009", description: "Real Grade 1/144", costPrice: 1900, unitPrice: 3200, stockQuantity: 14, reorderLevel: 5, deleted: false },
  { id: 11, name: "Tamiya Acrylic Paint X-1 Black", category: "Paint", barcode: "4950344810000", description: "10ml acrylic", costPrice: 55, unitPrice: 110, stockQuantity: 60, reorderLevel: 20, deleted: false },
  { id: 12, name: "Mr. Hobby Cement 40ml", category: "Tools", barcode: "4973028500011", description: "Plastic model cement", costPrice: 120, unitPrice: 230, stockQuantity: 3, reorderLevel: 8, deleted: false },
  { id: 13, name: "Traxxas 2S LiPo Battery 5800mAh", category: "RC Parts", barcode: "020334029805", description: "7.4V LiPo pack", costPrice: 1400, unitPrice: 2350, stockQuantity: 10, reorderLevel: 4, deleted: false },
  { id: 14, name: "God Hand Nipper SPN-120", category: "Tools", barcode: "4562113642189", description: "Ultra-thin single blade nipper", costPrice: 1600, unitPrice: 2600, stockQuantity: 4, reorderLevel: 3, deleted: false },
];

const seedUsers: (SessionUser & { password: string })[] = [
  { id: 1, username: "admin", password: "admin", firstName: "Store", lastName: "Admin", role: "ADMIN" },
  { id: 2, username: "cashier", password: "cashier", firstName: "Front", lastName: "Desk", role: "CASHIER" },
];

// Categories with short code prefixes used to generate product codes.
const seedCategories: Category[] = [
  { id: 1, name: "Drivetrain", prefix: "DRV" },
  { id: 2, name: "Tires", prefix: "TIR" },
  { id: 3, name: "Accessories", prefix: "ACC" },
  { id: 4, name: "Components", prefix: "CMP" },
  { id: 5, name: "Care", prefix: "CAR" },
  { id: 6, name: "RC Kits", prefix: "RCK" },
  { id: 7, name: "Model Kits", prefix: "MDL" },
  { id: 8, name: "Paint", prefix: "PNT" },
  { id: 9, name: "Tools", prefix: "TOL" },
  { id: 10, name: "RC Parts", prefix: "RCP" },
];

// Product templates — one canonical code per product; every unit shares it.
// Codes seeded to match each product's existing barcode so scanning works.
const seedTemplates: ProductTemplate[] = seedProducts.map((p) => ({
  id: p.id,
  name: p.name,
  categoryId: seedCategories.find((c) => c.name === p.category)?.id ?? 1,
  code: p.barcode ?? "",
  defaultCostPrice: p.costPrice,
  defaultUnitPrice: p.unitPrice,
}));

// ---- Store singleton ------------------------------------------------------

interface DB {
  products: Product[];
  sales: Sale[];
  inventory: InventoryTransaction[];
  settings: StoreSettings;
  categories: Category[];
  templates: ProductTemplate[];
  reservations: Reservation[];
  preOrders: PreOrder[];
  nextProductId: number;
  nextSaleId: number;
  nextInvId: number;
  nextCategoryId: number;
  nextTemplateId: number;
  nextReservationId: number;
  nextPreOrderId: number;
  codeSeq: number;
  saleSeq: number;
  reservationSeq: number;
  preOrderSeq: number;
}

const g = globalThis as unknown as { __keidenceDB?: DB };

function initDB(): DB {
  return {
    products: seedProducts.map((p) => ({ ...p })),
    sales: [],
    inventory: seedProducts.map((p, i) => ({
      id: i + 1,
      productId: p.id,
      userId: 1,
      reason: "INITIAL" as const,
      quantityChange: p.stockQuantity,
      comment: "Opening stock",
      saleId: null,
      createdAt: new Date().toISOString(),
    })),
    settings: loadSettings(),
    categories: seedCategories.map((c) => ({ ...c })),
    templates: seedTemplates.map((t) => ({ ...t })),
    reservations: loadReservations(),
    preOrders: loadPreOrders(),
    nextProductId: seedProducts.length + 1,
    nextSaleId: 1,
    nextInvId: seedProducts.length + 1,
    nextCategoryId: seedCategories.length + 1,
    nextTemplateId: seedProducts.length + 1,
    nextReservationId: nextReservationIdFrom(loadReservations()),
    nextPreOrderId: loadPreOrders().reduce((m, p) => Math.max(m, p.id), 0) + 1,
    codeSeq: 1000,
    saleSeq: 1,
    reservationSeq: reservationSeqFrom(loadReservations()),
    preOrderSeq: loadPreOrders().length + 1,
  };
}

const PREORDERS_KEY = "keidence.preOrders";

function loadPreOrders(): PreOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREORDERS_KEY);
    if (raw) return JSON.parse(raw) as PreOrder[];
  } catch {
    /* ignore */
  }
  return [];
}

function persistPreOrders(list: PreOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREORDERS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const RESERVATIONS_KEY = "keidence.reservations";

function loadReservations(): Reservation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RESERVATIONS_KEY);
    if (raw) return JSON.parse(raw) as Reservation[];
  } catch {
    /* ignore */
  }
  return [];
}

function persistReservations(list: Reservation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function nextReservationIdFrom(list: Reservation[]): number {
  return list.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}
function reservationSeqFrom(list: Reservation[]): number {
  return list.length + 1;
}

function db(): DB {
  if (!g.__keidenceDB) g.__keidenceDB = initDB();
  return g.__keidenceDB;
}

// ---- pub/sub --------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

// Version bumps on every mutation. Cached selectors below key their memoized
// result on this so they return a STABLE reference until data actually
// changes — required by useSyncExternalStore to avoid an infinite render loop.
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

/**
 * Memoize a derived selector on the store version. Returns the same reference
 * across renders until the store mutates, then recomputes once.
 */
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

// ---- Settings -------------------------------------------------------------

export const getSettings = cached((): StoreSettings => ({ ...db().settings }));

export function updateSettings(patch: Partial<StoreSettings>): StoreSettings {
  const store = db();
  store.settings = { ...store.settings, ...patch };
  persistSettings(store.settings);
  emit();
  return { ...store.settings };
}

// ---- Categories -----------------------------------------------------------

export const getCategories = cached((): Category[] =>
  db().categories.slice().sort((a, b) => a.name.localeCompare(b.name))
);

export function getCategory(id: number): Category | undefined {
  return db().categories.find((c) => c.id === id);
}

export function upsertCategory(
  input: Omit<Category, "id"> & { id?: number }
): Category {
  const store = db();
  const prefix = (input.prefix || input.name.slice(0, 3))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  if (input.id) {
    const idx = store.categories.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      store.categories[idx] = { ...store.categories[idx], name: input.name, prefix };
      emit();
      return store.categories[idx];
    }
  }
  const created: Category = { id: store.nextCategoryId++, name: input.name, prefix };
  store.categories.push(created);
  emit();
  return created;
}

export function deleteCategory(id: number): void {
  const store = db();
  store.categories = store.categories.filter((c) => c.id !== id);
  emit();
}

// ---- Product templates ----------------------------------------------------

export const getTemplates = cached((): ProductTemplate[] =>
  db().templates.slice().sort((a, b) => a.name.localeCompare(b.name))
);

export function getTemplate(id: number): ProductTemplate | undefined {
  return db().templates.find((t) => t.id === id);
}

/** Find a template by its product code (what gets scanned). */
export function getTemplateByCode(code: string): ProductTemplate | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return db().templates.find((t) => t.code === c);
}

/** Generate a unique product code, e.g. KEI-DRV-1042. */
export function generateProductCode(categoryId: number): string {
  const store = db();
  const cat = store.categories.find((c) => c.id === categoryId);
  const prefix = cat?.prefix || "GEN";
  let code: string;
  do {
    code = `KEI-${prefix}-${store.codeSeq++}`;
  } while (store.templates.some((t) => t.code === code));
  return code;
}

export function upsertTemplate(
  input: Omit<ProductTemplate, "id" | "code"> & { id?: number; code?: string }
): ProductTemplate {
  const store = db();
  if (input.id) {
    const idx = store.templates.findIndex((t) => t.id === input.id);
    if (idx >= 0) {
      store.templates[idx] = {
        ...store.templates[idx],
        name: input.name,
        categoryId: input.categoryId,
        defaultCostPrice: input.defaultCostPrice,
        defaultUnitPrice: input.defaultUnitPrice,
        code: input.code || store.templates[idx].code,
      };
      emit();
      return store.templates[idx];
    }
  }
  const created: ProductTemplate = {
    id: store.nextTemplateId++,
    name: input.name,
    categoryId: input.categoryId,
    code: input.code || generateProductCode(input.categoryId),
    defaultCostPrice: input.defaultCostPrice,
    defaultUnitPrice: input.defaultUnitPrice,
  };
  store.templates.push(created);
  emit();
  return created;
}

export function deleteTemplate(id: number): void {
  const store = db();
  store.templates = store.templates.filter((t) => t.id !== id);
  emit();
}

// ---- Reservations ---------------------------------------------------------

export const getReservations = cached((): Reservation[] =>
  db()
    .reservations.slice()
    .sort((a, b) =>
      a.date === b.date
        ? (a.hours[0] ?? 0) - (b.hours[0] ?? 0)
        : a.date < b.date
          ? -1
          : 1
    )
);

/** Reservations for a given ISO date, excluding cancelled. */
export function getReservationsForDate(date: string): Reservation[] {
  return db().reservations.filter(
    (r) => r.date === date && r.status !== "CANCELLED"
  );
}

/** Which start-hours are already taken on a date (blocked slots). */
export function getBookedHours(date: string): Map<number, Reservation> {
  const map = new Map<number, Reservation>();
  for (const r of getReservationsForDate(date)) {
    for (const h of r.hours) map.set(h, r);
  }
  return map;
}

function makeReservationRef(seq: number, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `RES-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}

/**
 * Create a reservation. Returns null if any requested hour is already booked
 * on that date (slot blocking — no double-booking).
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
  const store = db();
  const taken = getBookedHours(input.date);
  if (input.hours.some((h) => taken.has(h))) return null;

  const reservation: Reservation = {
    id: store.nextReservationId++,
    reference: makeReservationRef(store.reservationSeq++),
    customerName: input.customerName,
    contactNumber: input.contactNumber,
    contactEmail: input.contactEmail,
    socialMedia: input.socialMedia,
    date: input.date,
    hours: [...input.hours].sort((a, b) => a - b),
    hourlyRate: input.hourlyRate,
    taxRate: input.taxRate,
    taxInclusive: input.taxInclusive,
    notes: input.notes,
    status: "BOOKED",
    createdAt: new Date().toISOString(),
  };
  store.reservations.push(reservation);
  persistReservations(store.reservations);
  emit();
  return reservation;
}

export function updateReservationStatus(
  id: number,
  status: Reservation["status"]
): void {
  const store = db();
  const r = store.reservations.find((x) => x.id === id);
  if (r) {
    r.status = status;
    persistReservations(store.reservations);
    emit();
  }
}

export function deleteReservation(id: number): void {
  const store = db();
  store.reservations = store.reservations.filter((r) => r.id !== id);
  persistReservations(store.reservations);
  emit();
}

// ---- Pre-orders (batch sales) ---------------------------------------------

export const getPreOrders = cached((): PreOrder[] =>
  db()
    .preOrders.slice()
    .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))
);

export function getActivePreOrders(): PreOrder[] {
  return getPreOrders().filter((p) => p.status !== "CANCELLED");
}

function makePreOrderRef(seq: number, date: string): string {
  const compact = date.replace(/-/g, "");
  return `PO-${compact}-${String(seq).padStart(4, "0")}`;
}

/**
 * Derive an order's status from its line items' received flags. Preserves an
 * explicit COMPLETED / CANCELLED; otherwise: no items received = PENDING,
 * some = ORDERING, all = READY.
 */
function deriveStatus(order: PreOrder): PreOrder["status"] {
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
  const store = db();
  const order: PreOrder = {
    id: store.nextPreOrderId++,
    reference: makePreOrderRef(store.preOrderSeq++, input.expectedDate),
    clientName: input.clientName,
    contactNumber: input.contactNumber,
    contactEmail: input.contactEmail,
    socialMedia: input.socialMedia,
    expectedDate: input.expectedDate,
    lines: input.lines.map((l) => ({ ...l, received: false })),
    taxRate: input.taxRate,
    taxInclusive: input.taxInclusive,
    notes: input.notes,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  store.preOrders.push(order);
  persistPreOrders(store.preOrders);
  emit();
  return order;
}

/** Toggle a single line's received flag and re-derive the order status. */
export function setPreOrderLineReceived(
  orderId: number,
  lineIndex: number,
  received: boolean
): void {
  const store = db();
  const order = store.preOrders.find((p) => p.id === orderId);
  if (!order || !order.lines[lineIndex]) return;
  order.lines[lineIndex].received = received;
  order.status = deriveStatus(order);
  persistPreOrders(store.preOrders);
  emit();
}

export function setPreOrderStatus(
  orderId: number,
  status: PreOrder["status"]
): void {
  const store = db();
  const order = store.preOrders.find((p) => p.id === orderId);
  if (!order) return;
  order.status = status;
  // If un-completing/un-cancelling, re-derive from line items.
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    order.status = deriveStatus(order);
  }
  persistPreOrders(store.preOrders);
  emit();
}

export function deletePreOrder(id: number): void {
  const store = db();
  store.preOrders = store.preOrders.filter((p) => p.id !== id);
  persistPreOrders(store.preOrders);
  emit();
}

export interface ProcurementItem {
  productId: number | null;
  name: string;
  unitPrice: number;
  totalQty: number;
  receivedQty: number;
  /** Which clients are waiting on this item, with per-client qty + received. */
  clients: {
    orderId: number;
    reference: string;
    clientName: string;
    lineIndex: number;
    quantity: number;
    received: boolean;
  }[];
}

/**
 * Aggregate all outstanding pre-order lines into a per-product sourcing list.
 * Optionally filter to a single expected date. Cancelled & completed orders
 * are excluded (nothing left to source).
 */
export function getProcurement(dateFilter?: string): ProcurementItem[] {
  const orders = db().preOrders.filter(
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

/** Distinct expected dates that have active (non-cancelled) pre-orders. */
export function getPreOrderDates(): string[] {
  const set = new Set<string>();
  for (const p of db().preOrders) {
    if (p.status !== "CANCELLED") set.add(p.expectedDate);
  }
  return Array.from(set).sort();
}

// ---- Auth (stub) ----------------------------------------------------------

export function authenticate(
  username: string,
  password: string
): SessionUser | null {
  const u = seedUsers.find(
    (x) => x.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!u || u.password !== password) return null;
  const { password: _pw, ...session } = u;
  return session;
}

// ---- Products -------------------------------------------------------------

export const getProducts = cached((): Product[] =>
  db().products.filter((p) => !p.deleted)
);

export function getProduct(id: number): Product | undefined {
  return db().products.find((p) => p.id === id && !p.deleted);
}

/** Look up a product by scanned barcode/QR value. */
export function findByBarcode(code: string): Product | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return db().products.find(
    (p) => !p.deleted && (p.barcode === c || String(p.id) === c)
  );
}

export function upsertProduct(
  input: Omit<Product, "id" | "deleted"> & { id?: number }
): Product {
  const store = db();
  if (input.id) {
    const idx = store.products.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      const prev = store.products[idx];
      const updated: Product = { ...prev, ...input, id: prev.id };
      // If stock was edited directly, record an adjustment movement.
      if (updated.stockQuantity !== prev.stockQuantity) {
        recordMovement(
          updated.id,
          updated.stockQuantity - prev.stockQuantity,
          "ADJUSTMENT",
          "Manual stock edit"
        );
      }
      store.products[idx] = updated;
      emit();
      return updated;
    }
  }
  const created: Product = {
    ...input,
    id: store.nextProductId++,
    deleted: false,
  };
  store.products.push(created);
  recordMovement(created.id, created.stockQuantity, "INITIAL", "Product created");
  emit();
  return created;
}

export function deleteProduct(id: number): void {
  const p = db().products.find((x) => x.id === id);
  if (p) {
    p.deleted = true;
    emit();
  }
}

export function adjustStock(
  productId: number,
  delta: number,
  comment: string
): void {
  const p = getProduct(productId);
  if (!p) return;
  p.stockQuantity += delta;
  recordMovement(productId, delta, "ADJUSTMENT", comment);
  emit();
}

function recordMovement(
  productId: number,
  quantityChange: number,
  reason: InventoryTransaction["reason"],
  comment: string,
  saleId: number | null = null
) {
  const store = db();
  store.inventory.push({
    id: store.nextInvId++,
    productId,
    userId: 1,
    reason,
    quantityChange,
    comment,
    saleId,
    createdAt: new Date().toISOString(),
  });
}

export function getMovementsForProduct(
  productId: number
): InventoryTransaction[] {
  return db()
    .inventory.filter((m) => m.productId === productId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---- Sales ----------------------------------------------------------------

export const getSales = cached((): Sale[] =>
  db().sales.slice().sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1))
);

/**
 * Complete a sale: writes the sale record, records SALE inventory movements,
 * and decrements product stock. This is the link between sales and inventory.
 */
export function completeSale(params: {
  userId: number;
  customerName: string;
  lines: CartLine[];
  payments: SalePayment[];
  taxRate?: number;
  taxInclusive?: boolean;
}): Sale {
  const store = db();
  const subtotal = params.lines.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0
  );
  const rate = params.taxRate ?? store.settings.defaultVatRate;
  const inclusive = params.taxInclusive ?? store.settings.vatInclusive;
  const vat = computeVat(subtotal, rate, inclusive);

  const sale: Sale = {
    id: store.nextSaleId++,
    invoiceNumber: makeInvoiceNumber(store.saleSeq++),
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

  store.sales.push(sale);

  // Decrement inventory for each line and write the ledger movement.
  for (const line of params.lines) {
    const p = store.products.find((x) => x.id === line.productId);
    if (p) {
      p.stockQuantity -= line.quantity;
      recordMovement(
        p.id,
        -line.quantity,
        "SALE",
        `Sale ${sale.invoiceNumber}`,
        sale.id
      );
    }
  }

  emit();
  return sale;
}

// ---- Dashboard helpers ----------------------------------------------------

export const getLowStockProducts = cached((): Product[] =>
  db().products.filter(
    (p) => !p.deleted && p.stockQuantity <= p.reorderLevel
  )
);
