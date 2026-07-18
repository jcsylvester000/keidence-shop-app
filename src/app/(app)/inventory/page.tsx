"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  PackagePlus,
  AlertTriangle,
  X,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScanField } from "@/components/scan-field";
import { useStore } from "@/lib/use-store";
import {
  getProducts,
  upsertProduct,
  adjustStock,
  getMovementsForProduct,
  deleteProduct,
  getCategories,
  getTemplates,
  getTemplateByCode,
  getCategory,
} from "@/data/store";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductTemplate } from "@/lib/types";
import { Sparkles } from "lucide-react";

type StockFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const products = useStore(() => getProducts());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && p.stockQuantity <= p.reorderLevel) ||
        (filter === "out" && p.stockQuantity <= 0);
      return matchesQuery && matchesFilter;
    });
  }, [products, query, filter]);

  const lowCount = products.filter(
    (p) => p.stockQuantity <= p.reorderLevel
  ).length;

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Inventory</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {products.length} products · {lowCount} at or below reorder level
          </p>
        </div>
        <Button size="lg" onClick={() => setEditing("new")}>
          <Plus className="h-5 w-5" />
          Add product
        </Button>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, category, or barcode…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
          {(["all", "low", "out"] as StockFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors " +
                (filter === f
                  ? "bg-brand-600 text-white"
                  : "text-ink-muted hover:bg-surface-muted")
              }
            >
              {f === "all" ? "All" : f === "low" ? "Low stock" : "Out"}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium text-ink-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-xs text-ink-faint">
                    {formatCurrency(p.costPrice)} cost
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted">{p.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                  {p.barcode ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {formatCurrency(p.unitPrice)}
                </td>
                <td className="px-4 py-3 text-center">
                  <StockBadge product={p} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn
                      title="Adjust stock"
                      onClick={() => setAdjusting(p)}
                    >
                      <PackagePlus className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="History" onClick={() => setHistory(p)}>
                      <History className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Edit" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-faint">
            No products found.
          </p>
        )}
      </Card>

      {/* Cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-xs text-ink-faint">{p.category}</div>
                </div>
                <StockBadge product={p} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-brand-700">
                  {formatCurrency(p.unitPrice)}
                </span>
                <div className="flex gap-1">
                  <IconBtn title="Adjust" onClick={() => setAdjusting(p)}>
                    <PackagePlus className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="History" onClick={() => setHistory(p)}>
                    <History className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Edit" onClick={() => setEditing(p)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-faint">
            No products found.
          </p>
        )}
      </div>

      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={
            editing !== "new"
              ? () => {
                  deleteProduct(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
      {adjusting && (
        <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />
      )}
      {history && (
        <HistoryModal product={history} onClose={() => setHistory(null)} />
      )}
    </div>
  );
}

function StockBadge({ product }: { product: Product }) {
  const out = product.stockQuantity <= 0;
  const low = product.stockQuantity <= product.reorderLevel;
  return (
    <Badge tone={out ? "danger" : low ? "warning" : "success"}>
      {low && <AlertTriangle className="h-3 w-3" />}
      {product.stockQuantity} in stock
    </Badge>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      {children}
    </button>
  );
}

// --- Modals ----------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-surface shadow-pop">
        <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onDelete,
}: {
  product: Product | null;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const categories = useStore(() => getCategories());
  const templates = useStore(() => getTemplates());

  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    barcode: product?.barcode ?? "",
    description: product?.description ?? "",
    costPrice: String(product?.costPrice ?? ""),
    unitPrice: String(product?.unitPrice ?? ""),
    stockQuantity: String(product?.stockQuantity ?? ""),
    reorderLevel: String(product?.reorderLevel ?? ""),
  });
  const [templateId, setTemplateId] = useState<number | null>(
    product?.templateId ?? null
  );
  const [autoFilled, setAutoFilled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Apply a template's details to the form (name, category, prices, code). */
  function applyTemplate(t: ProductTemplate) {
    const catName = getCategory(t.categoryId)?.name ?? "";
    setForm((f) => ({
      ...f,
      name: t.name,
      category: catName,
      barcode: t.code,
      costPrice: String(t.defaultCostPrice),
      unitPrice: String(t.defaultUnitPrice),
    }));
    setTemplateId(t.id);
    setAutoFilled(t.name);
    setTimeout(() => setAutoFilled(null), 2500);
  }

  /** When a code is typed/scanned, auto-load its template if known. */
  function onCodeChange(code: string) {
    setForm((f) => ({ ...f, barcode: code }));
    const t = getTemplateByCode(code);
    if (t) applyTemplate(t);
  }

  function save() {
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    upsertProduct({
      id: product?.id,
      name: form.name.trim(),
      category: form.category.trim() || "Uncategorized",
      barcode: form.barcode.trim() || null,
      description: form.description.trim(),
      costPrice: parseFloat(form.costPrice) || 0,
      unitPrice: parseFloat(form.unitPrice) || 0,
      stockQuantity: parseFloat(form.stockQuantity) || 0,
      reorderLevel: parseFloat(form.reorderLevel) || 0,
      templateId,
    });
    onClose();
  }

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <ModalShell
      title={product ? "Edit product" : "Add product"}
      onClose={onClose}
    >
      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Smart barcode/SKU — scan a known product code to auto-load it. */}
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Product code / Barcode / QR</Label>
          <ScanField
            id="barcode"
            value={form.barcode}
            onChange={onCodeChange}
            placeholder="Scan or type — known codes auto-fill the product"
          />
          <p className="text-xs text-ink-faint">
            Scan an existing product&apos;s code and its name, category, and
            prices fill in automatically. New codes are generated from the
            catalog.
          </p>
        </div>

        {/* Template picker — pick a predefined product to auto-fill. */}
        {templates.length > 0 && (
          <div className="space-y-1.5">
            <Label>Or pick a product template</Label>
            <Select
              value=""
              onChange={(e) => {
                const t = templates.find(
                  (x) => x.id === Number(e.target.value)
                );
                if (t) applyTemplate(t);
              }}
              placeholder="Choose a saved product…"
              options={templates.map((t) => ({
                value: String(t.id),
                label: `${t.name} — ${formatCurrency(t.defaultUnitPrice)}`,
              }))}
            />
          </div>
        )}

        {autoFilled && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Sparkles className="h-4 w-4" />
            Auto-filled from &ldquo;{autoFilled}&rdquo;.
          </div>
        )}

        {field("name", "Name", { placeholder: "e.g. Shimano Chain 11sp" })}

        {/* Category dropdown from the catalog (with free-text fallback). */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          {categories.length > 0 ? (
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Choose a category…"
              options={categories.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
            />
          ) : (
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Drivetrain"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("costPrice", "Cost price", { type: "number", placeholder: "0.00" })}
          {field("unitPrice", "Sell price", { type: "number", placeholder: "0.00" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("stockQuantity", "Stock qty", { type: "number", placeholder: "0" })}
          {field("reorderLevel", "Reorder at", { type: "number", placeholder: "0" })}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-surface-border p-4">
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>{product ? "Save changes" : "Add product"}</Button>
      </div>
    </ModalShell>
  );
}

function AdjustModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [comment, setComment] = useState("");
  const deltaNum = parseFloat(delta) || 0;
  const newQty = product.stockQuantity + deltaNum;

  return (
    <ModalShell title="Adjust stock" onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="rounded-xl bg-surface-muted p-4">
          <div className="text-sm font-medium text-ink">{product.name}</div>
          <div className="mt-1 text-sm text-ink-muted">
            Current stock: <strong>{product.stockQuantity}</strong>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Change (use a negative number to remove)</Label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDelta("-1")}>
              −1
            </Button>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 10 or -2"
              className="text-center"
            />
            <Button variant="outline" onClick={() => setDelta("1")}>
              +1
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            New stock will be <strong>{newQty}</strong>
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Reason (optional)</Label>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Restock, damage, count correction…"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={deltaNum === 0}
          onClick={() => {
            adjustStock(
              product.id,
              deltaNum,
              comment.trim() || "Manual adjustment"
            );
            onClose();
          }}
        >
          Apply adjustment
        </Button>
      </div>
    </ModalShell>
  );
}

function HistoryModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const movements = getMovementsForProduct(product.id);
  return (
    <ModalShell title="Stock history" onClose={onClose}>
      <div className="p-5">
        <div className="mb-4 text-sm font-medium text-ink">{product.name}</div>
        {movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">
            No movements recorded.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm text-ink">{m.comment}</div>
                  <div className="text-xs text-ink-faint">
                    {m.reason} ·{" "}
                    {new Date(m.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span
                  className={
                    "text-sm font-semibold " +
                    (m.quantityChange >= 0 ? "text-emerald-600" : "text-red-600")
                  }
                >
                  {m.quantityChange >= 0 ? "+" : ""}
                  {m.quantityChange}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
