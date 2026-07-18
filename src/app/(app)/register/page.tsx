"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ReceiptView } from "@/components/receipt-view";
import { useStore } from "@/lib/use-store";
import {
  getProducts,
  findByBarcode,
  completeSale,
} from "@/data/store";
import {
  formatCurrency,
  computeVat,
  DEFAULT_VAT_RATE,
} from "@/lib/utils";
import { useSession } from "@/lib/session";
import type { CartLine, Product, Sale, SalePayment } from "@/lib/types";

const PAYMENT_TYPES = ["Cash", "Card", "GCash", "Bank Transfer"];

export default function RegisterPage() {
  const { user } = useSession();
  const products = useStore(() => getProducts());

  const [scanValue, setScanValue] = useState("");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // VAT — defaults to 12% inclusive (PH standard), editable by the cashier.
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT_RATE);
  const [vatInclusive, setVatInclusive] = useState<boolean>(true);
  const [vatEditing, setVatEditing] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const vat = computeVat(subtotal, vatRate, vatInclusive);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  }

  function addToCart(product: Product, qty = 1) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + qty }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          unitPrice: product.unitPrice,
          quantity: qty,
          stockQuantity: product.stockQuantity,
        },
      ];
    });
  }

  /** Resolve a scanned/typed code to a product and add it. */
  const handleScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const product = findByBarcode(trimmed);
    if (product) {
      addToCart(product);
      notify(`Added ${product.name}`);
    } else {
      notify(`No product matches "${trimmed}"`);
    }
    setScanValue("");
    scanInputRef.current?.focus();
  }, []);

  // Keep a live ref to handleScan so the global listener never goes stale.
  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;

  // ---- Global hardware-scanner capture ------------------------------------
  // USB / Bluetooth barcode & QR scanners behave like keyboards that "type"
  // the code very fast and end with Enter. This listener captures that burst
  // anywhere on the register screen — even if the scan field lost focus — so a
  // scan always lands. Human typing (slow, or into another input) is ignored.
  useEffect(() => {
    let buffer = "";
    let lastTime = 0;

    function onKeyDown(e: KeyboardEvent) {
      // If the user is typing into a real input/textarea, let them — the scan
      // field's own onSubmit handles that case.
      const el = e.target as HTMLElement | null;
      const typingInField =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      const now = Date.now();
      // A gap > 100ms means a new keystroke sequence (human), reset buffer.
      if (now - lastTime > 100) buffer = "";
      lastTime = now;

      if (e.key === "Enter") {
        // Only treat as a scan if we accumulated a fast burst of characters.
        if (buffer.length >= 3 && !typingInField) {
          e.preventDefault();
          handleScanRef.current(buffer);
        }
        buffer = "";
        return;
      }

      // Collect printable single characters.
      if (e.key.length === 1) {
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setQty(productId: number, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) =>
            l.productId === productId ? { ...l, quantity: qty } : l
          )
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            (p.barcode ?? "").includes(q)
        )
      : products;
    return list.slice(0, 24);
  }, [products, query]);

  if (completedSale) {
    return (
      <ReceiptView
        sale={completedSale}
        onNewSale={() => {
          setCompletedSale(null);
          setCart([]);
          scanInputRef.current?.focus();
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Left: scan + catalog */}
      <div className="flex min-w-0 flex-1 flex-col border-b border-surface-border lg:border-b-0 lg:border-r">
        <div className="border-b border-surface-border bg-surface p-4">
          <div className="flex gap-2">
            <form
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(scanValue);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                ref={scanInputRef}
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="Scan barcode / QR or type a code, then Enter"
                className="h-12 pl-9 text-base"
                inputMode="text"
              />
            </form>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => setScannerOpen(true)}
              className="shrink-0"
            >
              <Camera className="h-5 w-5" />
              <span className="hidden sm:inline">Camera</span>
            </Button>
          </div>

          <p className="mt-1.5 text-xs text-ink-faint">
            Hardware barcode &amp; QR scanners work anywhere on this screen — or
            tap Camera to scan with the device camera.
          </p>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the catalog…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const out = p.stockQuantity <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className="flex flex-col rounded-xl border border-surface-border bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
                >
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <span className="text-[11px] font-medium text-ink-faint">
                      {p.category}
                    </span>
                    <Badge tone={out ? "danger" : p.stockQuantity <= p.reorderLevel ? "warning" : "default"}>
                      {p.stockQuantity}
                    </Badge>
                  </div>
                  <div className="line-clamp-2 flex-1 text-sm font-medium text-ink">
                    {p.name}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-brand-700">
                    {formatCurrency(p.unitPrice)}
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-ink-faint">
              No products match your search.
            </p>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="flex w-full flex-col bg-surface lg:w-[380px] xl:w-[420px]">
        <div className="flex items-center justify-between border-b border-surface-border p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <ShoppingCart className="h-5 w-5 text-brand-600" />
            Current sale
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs font-medium text-ink-muted hover:text-red-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-ink-faint">
              <ShoppingCart className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                Scan or tap a product to start a sale.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {cart.map((l) => (
                <li key={l.productId} className="flex gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {l.name}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {formatCurrency(l.unitPrice)} each
                    </div>
                    {l.quantity > l.stockQuantity && (
                      <div className="mt-1 text-xs font-medium text-amber-600">
                        Only {l.stockQuantity} in stock
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-sm font-semibold text-ink">
                      {formatCurrency(l.unitPrice * l.quantity)}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(l.productId, l.quantity - 1)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-surface-border text-ink-muted hover:bg-surface-muted"
                        aria-label="Decrease"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-medium">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() => setQty(l.productId, l.quantity + 1)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-surface-border text-ink-muted hover:bg-surface-muted"
                        aria-label="Increase"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setQty(l.productId, 0)}
                        className="ml-1 grid h-7 w-7 place-items-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals + checkout */}
        <div className="border-t border-surface-border p-4">
          {/* Breakdown */}
          <div className="mb-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>
                {itemCount} item{itemCount === 1 ? "" : "s"} · Net
              </span>
              <span>{formatCurrency(vat.net)}</span>
            </div>

            <div className="flex items-center justify-between text-ink-muted">
              <button
                type="button"
                onClick={() => setVatEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-surface-muted"
                title="Edit VAT"
              >
                VAT ({vatRate}% {vatInclusive ? "incl." : "excl."})
                <Pencil className="h-3 w-3" />
              </button>
              <span>{formatCurrency(vat.vat)}</span>
            </div>

            {vatEditing && (
              <div className="rounded-lg border border-surface-border bg-surface-muted p-3">
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-xs font-medium text-ink">
                    Rate %
                  </label>
                  <Input
                    type="number"
                    value={String(vatRate)}
                    onChange={(e) =>
                      setVatRate(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="h-8 w-20 text-center"
                  />
                  <div className="ml-auto flex gap-1">
                    {[0, 12].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setVatRate(r)}
                        className="rounded border border-surface-border bg-surface px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setVatInclusive(true)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                      (vatInclusive
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-surface-border bg-surface text-ink-muted hover:bg-surface-muted")
                    }
                  >
                    VAT included in price
                  </button>
                  <button
                    type="button"
                    onClick={() => setVatInclusive(false)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                      (!vatInclusive
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-surface-border bg-surface text-ink-muted hover:bg-surface-muted")
                    }
                  >
                    Add VAT on top
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-surface-border pt-2">
              <span className="text-ink-muted">Total</span>
              <span className="text-2xl font-semibold text-ink">
                {formatCurrency(vat.grandTotal)}
              </span>
            </div>
          </div>

          <Button
            size="xl"
            className="w-full"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            Charge {formatCurrency(vat.grandTotal)}
          </Button>
        </div>
      </div>

      {/* Flash toast */}
      {flash && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-pop">
          {flash}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        continuous
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          // Continuous mode: add the item and keep the camera open so the
          // cashier can scan the next product without reopening.
          handleScan(code);
        }}
      />

      {checkoutOpen && (
        <CheckoutModal
          total={vat.grandTotal}
          vatLabel={`Incl. ${formatCurrency(vat.vat)} VAT (${vatRate}%${
            vatInclusive ? ", inclusive" : ", added"
          })`}
          onClose={() => setCheckoutOpen(false)}
          onComplete={(payments, customerName) => {
            const sale = completeSale({
              userId: user!.id,
              customerName,
              lines: cart,
              payments,
              taxRate: vatRate,
              taxInclusive: vatInclusive,
            });
            setCheckoutOpen(false);
            setCompletedSale(sale);
          }}
        />
      )}
    </div>
  );
}

// --- Checkout modal --------------------------------------------------------

function CheckoutModal({
  total,
  vatLabel,
  onClose,
  onComplete,
}: {
  total: number;
  vatLabel?: string;
  onClose: () => void;
  onComplete: (payments: SalePayment[], customerName: string) => void;
}) {
  const [paymentType, setPaymentType] = useState("Cash");
  const [tendered, setTendered] = useState<string>(total.toFixed(2));
  const [customerName, setCustomerName] = useState("");

  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - total;
  const canComplete = paymentType !== "Cash" || tenderedNum >= total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">Checkout</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-surface-muted p-4 text-center">
            <div className="text-sm text-ink-muted">Amount due</div>
            <div className="text-3xl font-semibold text-ink">
              {formatCurrency(total)}
            </div>
            {vatLabel && (
              <div className="mt-1 text-xs text-ink-faint">{vatLabel}</div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-ink">
              Payment method
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setPaymentType(t)}
                  className={
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                    (paymentType === t
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-surface-border text-ink-muted hover:bg-surface-muted")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {paymentType === "Cash" && (
            <div>
              <div className="mb-2 text-sm font-medium text-ink">
                Cash tendered
              </div>
              <Input
                type="number"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className="h-12 text-lg"
              />
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-ink-muted">Change</span>
                <span
                  className={
                    "font-semibold " +
                    (change < 0 ? "text-red-600" : "text-emerald-600")
                  }
                >
                  {formatCurrency(Math.max(0, change))}
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-ink">
              Customer name{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </div>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in"
            />
          </div>
        </div>

        <div className="border-t border-surface-border p-4">
          <Button
            size="xl"
            className="w-full"
            disabled={!canComplete}
            onClick={() =>
              onComplete(
                [{ paymentType, amount: total }],
                customerName.trim() || "Walk-in"
              )
            }
          >
            Complete sale
          </Button>
        </div>
      </div>
    </div>
  );
}
