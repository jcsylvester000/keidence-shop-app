"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Truck,
  Plus,
  Search,
  X,
  Trash2,
  Package,
  CheckCircle2,
  Clock,
  FileText,
  FileType,
  Bell,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/use-store";
import {
  getProducts,
  getSettings,
  getActivePreOrders,
  createPreOrder,
  deletePreOrder,
  setPreOrderStatus,
  setPreOrderLineReceived,
  getProcurement,
  getPreOrderDates,
} from "@/data/store";
import { formatCurrency, computeVat, cn } from "@/lib/utils";
import {
  downloadPreOrderPdf,
  downloadPreOrderDocx,
} from "@/lib/preorder-docs";
import type { PreOrder, PreOrderLine } from "@/lib/types";

type Tab = "orders" | "procurement";

function niceDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function orderTotal(o: PreOrder): number {
  const sub = o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return computeVat(sub, o.taxRate, o.taxInclusive).grandTotal;
}

const STATUS_TONE: Record<
  PreOrder["status"],
  "default" | "warning" | "brand" | "success" | "danger"
> = {
  PENDING: "default",
  ORDERING: "warning",
  READY: "success",
  COMPLETED: "brand",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<PreOrder["status"], string> = {
  PENDING: "Pending",
  ORDERING: "Sourcing",
  READY: "Ready for pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function BatchSalesPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const orders = useStore(() => getActivePreOrders());

  const readyCount = orders.filter((o) => o.status === "READY").length;
  const sourcingCount = orders.filter(
    (o) => o.status === "PENDING" || o.status === "ORDERING"
  ).length;

  return (
    <div className="mx-auto max-w-7xl p-5 md:p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Batch Sales</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Track client pre-orders, batch what needs sourcing from vendors, and
          get notified when orders are ready for pickup.
        </p>
      </div>

      {/* Notification strip */}
      {(readyCount > 0 || sourcingCount > 0) && (
        <div className="mb-5 flex flex-wrap gap-3">
          {readyCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Bell className="h-4 w-4" />
              <span className="font-medium">{readyCount}</span> order
              {readyCount === 1 ? "" : "s"} ready for pickup
            </div>
          )}
          {sourcingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{sourcingCount}</span> awaiting
              sourcing
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
        <button
          onClick={() => setTab("orders")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "orders"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <ClipboardList className="h-4 w-4" /> Orders
        </button>
        <button
          onClick={() => setTab("procurement")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "procurement"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <Truck className="h-4 w-4" /> Procurement
        </button>
      </div>

      {tab === "orders" ? <OrdersTab /> : <ProcurementTab />}
    </div>
  );
}

// --- Orders tab ------------------------------------------------------------

function OrdersTab() {
  const orders = useStore(() => getActivePreOrders());
  const [creating, setCreating] = useState(false);

  // Group orders by expected date.
  const grouped = useMemo(() => {
    const map = new Map<string, PreOrder[]>();
    for (const o of orders) {
      if (!map.has(o.expectedDate)) map.set(o.expectedDate, []);
      map.get(o.expectedDate)!.push(o);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : 1
    );
  }, [orders]);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New pre-order
        </Button>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-faint">
            No pre-orders yet. Create one to start batching.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-ink">{niceDate(date)}</h3>
                <Badge tone="default">
                  {list.length} order{list.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="space-y-2">
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateOrderModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function OrderCard({ order: o }: { order: PreOrder }) {
  const settings = useStore(() => getSettings());
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const receivedCount = o.lines.filter((l) => l.received).length;
  const progress =
    o.lines.length === 0 ? 0 : (receivedCount / o.lines.length) * 100;

  async function gen(
    fn: typeof downloadPreOrderPdf | typeof downloadPreOrderDocx,
    kind: "invoice" | "receipt",
    key: string
  ) {
    setBusy(key);
    try {
      await fn(o, settings, kind);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{o.clientName}</span>
              <Badge tone={STATUS_TONE[o.status]}>
                {STATUS_LABEL[o.status]}
              </Badge>
            </div>
            <div className="text-xs text-ink-muted">
              {o.reference} · {o.lines.length} item
              {o.lines.length === 1 ? "" : "s"} ·{" "}
              {[o.contactNumber, o.contactEmail].filter(Boolean).join(" · ") ||
                "no contact"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-ink">
              {formatCurrency(orderTotal(o))}
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {expanded ? "Hide items" : "View items"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress === 100 ? "bg-emerald-500" : "bg-brand-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-ink-faint">
            {receivedCount}/{o.lines.length} received
          </span>
        </div>

        {expanded && (
          <div className="mt-3 space-y-1.5 border-t border-surface-border pt-3">
            {o.lines.map((l, i) => (
              <label
                key={i}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={l.received}
                  onChange={(e) =>
                    setPreOrderLineReceived(o.id, i, e.target.checked)
                  }
                  className="h-4 w-4 accent-brand-600"
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    l.received
                      ? "text-ink-faint line-through"
                      : "text-ink"
                  )}
                >
                  {l.quantity} × {l.name}
                </span>
                <span className="text-sm text-ink-muted">
                  {formatCurrency(l.unitPrice * l.quantity)}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-3">
          <DocBtn
            label="Invoice PDF"
            icon={FileText}
            busy={busy === "ipdf"}
            onClick={() => gen(downloadPreOrderPdf, "invoice", "ipdf")}
          />
          <DocBtn
            label="Invoice Word"
            icon={FileType}
            busy={busy === "idoc"}
            onClick={() => gen(downloadPreOrderDocx, "invoice", "idoc")}
          />
          <DocBtn
            label="Receipt PDF"
            icon={FileText}
            busy={busy === "rpdf"}
            onClick={() => gen(downloadPreOrderPdf, "receipt", "rpdf")}
          />
          <div className="flex-1" />
          {o.status === "READY" && (
            <Button
              size="sm"
              onClick={() => setPreOrderStatus(o.id, "COMPLETED")}
            >
              <CheckCircle2 className="h-4 w-4" /> Mark picked up
            </Button>
          )}
          <button
            title="Delete order"
            onClick={() => deletePreOrder(o.id)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocBtn({
  label,
  icon: Icon,
  onClick,
  busy,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {busy ? "…" : label}
    </button>
  );
}

// --- Create order modal ----------------------------------------------------

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const products = useStore(() => getProducts());
  const settings = useStore(() => getSettings());

  const [client, setClient] = useState({
    clientName: "",
    contactNumber: "",
    contactEmail: "",
    socialMedia: "",
    notes: "",
  });
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<PreOrderLine[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      q
        ? products.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q) ||
              (p.barcode ?? "").includes(q)
          )
        : products
    ).slice(0, 20);
  }, [products, query]);

  function addItem(productId: number) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice: p.unitPrice,
          quantity: 1,
          received: false,
        },
      ];
    });
  }

  function setQty(idx: number, qty: number) {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((_, i) => i !== idx)
        : prev.map((l, i) => (i === idx ? { ...l, quantity: qty } : l))
    );
  }

  const sub = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const vat = computeVat(sub, settings.defaultVatRate, settings.vatInclusive);

  function save() {
    setError(null);
    if (!client.clientName.trim()) {
      setError("Please enter the client's name.");
      return;
    }
    if (!expectedDate) {
      setError("Please set an expected pickup date.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one pre-ordered item.");
      return;
    }
    createPreOrder({
      ...client,
      clientName: client.clientName.trim(),
      expectedDate,
      lines,
      taxRate: settings.defaultVatRate,
      taxInclusive: settings.vatInclusive,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">New pre-order</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden md:grid-cols-2">
          {/* Left: client + item picker */}
          <div className="space-y-4 overflow-auto border-b border-surface-border p-5 md:border-b-0 md:border-r">
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Client name</Label>
              <Input
                value={client.clientName}
                onChange={(e) =>
                  setClient({ ...client, clientName: e.target.value })
                }
                placeholder="Client name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact number</Label>
                <Input
                  value={client.contactNumber}
                  onChange={(e) =>
                    setClient({ ...client, contactNumber: e.target.value })
                  }
                  placeholder="09xx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={client.contactEmail}
                  onChange={(e) =>
                    setClient({ ...client, contactEmail: e.target.value })
                  }
                  placeholder="email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Social media</Label>
                <Input
                  value={client.socialMedia}
                  onChange={(e) =>
                    setClient({ ...client, socialMedia: e.target.value })
                  }
                  placeholder="FB / IG"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expected pickup date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Add items from inventory</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border border-surface-border">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-muted"
                  >
                    <span className="min-w-0 truncate text-sm text-ink">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatCurrency(p.unitPrice)}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-ink-faint">
                    No products found.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: order lines + total */}
          <div className="flex flex-col overflow-hidden p-5">
            <div className="mb-2 flex items-center gap-2 font-medium text-ink">
              <Package className="h-4 w-4 text-brand-600" /> Pre-ordered items
            </div>
            <div className="flex-1 overflow-auto">
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">
                  Search and tap products to add them.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-surface-border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {l.name}
                        </div>
                        <div className="text-xs text-ink-faint">
                          {formatCurrency(l.unitPrice)} each
                        </div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) =>
                          setQty(i, parseInt(e.target.value) || 0)
                        }
                        className="h-8 w-14 rounded-md border border-surface-border bg-surface text-center text-sm text-ink"
                      />
                      <button
                        onClick={() => setQty(i, 0)}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 space-y-1 border-t border-surface-border pt-3 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>VAT ({settings.defaultVatRate}%)</span>
                <span>{formatCurrency(vat.vat)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-ink">
                <span>Total</span>
                <span>{formatCurrency(vat.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-border p-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Create pre-order</Button>
        </div>
      </div>
    </div>
  );
}

// --- Procurement tab -------------------------------------------------------

function ProcurementTab() {
  // Subscribe to orders so this recomputes when anything changes.
  useStore(() => getActivePreOrders());
  const [dateFilter, setDateFilter] = useState<string>("");
  const dates = getPreOrderDates();
  const items = getProcurement(dateFilter || undefined);

  const totalUnits = items.reduce((s, it) => s + it.totalQty, 0);
  const receivedUnits = items.reduce((s, it) => s + it.receivedQty, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Everything that needs sourcing from vendors/warehouse, batched across
          all client orders. Mark items received as they arrive.
        </p>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-xs">Filter date</Label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 rounded-lg border border-surface-border bg-surface px-3 text-sm text-ink"
          >
            <option value="">All dates</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {niceDate(d)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-faint">
            Nothing to source. Everything is either received or completed.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${
                    totalUnits === 0 ? 0 : (receivedUnits / totalUnits) * 100
                  }%`,
                }}
              />
            </div>
            <span className="text-sm font-medium text-ink-muted">
              {receivedUnits}/{totalUnits} units received
            </span>
          </div>

          <div className="space-y-2">
            {items.map((it) => (
              <ProcurementRow key={`${it.productId}-${it.name}`} item={it} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProcurementRow({
  item,
}: {
  item: ReturnType<typeof getProcurement>[number];
}) {
  const [open, setOpen] = useState(false);
  const done = item.receivedQty >= item.totalQty;
  const allReceived = item.clients.every((c) => c.received);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">{item.name}</span>
              {done && (
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3" /> received
                </Badge>
              )}
            </div>
            <div className="text-xs text-ink-muted">
              {item.clients.length} client
              {item.clients.length === 1 ? "" : "s"} waiting ·{" "}
              {formatCurrency(item.unitPrice)} each
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-semibold text-ink">
                {item.totalQty}
              </div>
              <div className="text-xs text-ink-faint">
                {item.receivedQty} in
              </div>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted"
            >
              {open ? "Hide" : "Clients"}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-3 space-y-1.5 border-t border-surface-border pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                Mark received per client
              </span>
              <button
                onClick={() =>
                  item.clients.forEach((c) =>
                    setPreOrderLineReceived(c.orderId, c.lineIndex, !allReceived)
                  )
                }
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                {allReceived ? "Unmark all" : "Mark all received"}
              </button>
            </div>
            {item.clients.map((c) => (
              <label
                key={`${c.orderId}-${c.lineIndex}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={c.received}
                  onChange={(e) =>
                    setPreOrderLineReceived(
                      c.orderId,
                      c.lineIndex,
                      e.target.checked
                    )
                  }
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="flex-1 text-sm text-ink">
                  {c.clientName}{" "}
                  <span className="text-ink-faint">({c.reference})</span>
                </span>
                <span className="text-sm text-ink-muted">×{c.quantity}</span>
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
