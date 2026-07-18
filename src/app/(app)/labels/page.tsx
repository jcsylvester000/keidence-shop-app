"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Printer,
  Trash2,
  Tag,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode } from "@/components/qr-code";
import { useStore } from "@/lib/use-store";
import { getProducts, getSettings } from "@/data/store";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product, StoreSettings } from "@/lib/types";

type Format = "sheet" | "roll";

interface Selection {
  product: Product;
  qty: number;
}

export default function LabelsPage() {
  const products = useStore(() => getProducts());
  const settings = useStore(() => getSettings());

  const [query, setQuery] = useState("");
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [format, setFormat] = useState<Format>("sheet");
  const [columns, setColumns] = useState(3);
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);

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
    ).slice(0, 40);
  }, [products, query]);

  const chosen: Selection[] = useMemo(
    () =>
      Object.entries(selections)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          product: products.find((p) => p.id === Number(id))!,
          qty,
        }))
        .filter((s) => s.product),
    [selections, products]
  );

  const totalLabels = chosen.reduce((sum, s) => sum + s.qty, 0);

  // Flatten into one label per physical sticker.
  const labels: Product[] = chosen.flatMap((s) =>
    Array.from({ length: s.qty }, () => s.product)
  );

  function setQty(id: number, qty: number) {
    setSelections((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-semibold text-ink">Price Labels</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Generate QR price labels to stick on retail items. Scanning one at the
          register adds it to the sale and deducts stock automatically.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left: pick products + options */}
        <div className="space-y-4 print:hidden">
          <Card>
            <CardContent className="p-4">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="pl-9"
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-auto">
                {filtered.map((p) => {
                  const qty = selections[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {p.name}
                        </div>
                        <div className="text-xs text-ink-faint">
                          {formatCurrency(p.unitPrice)} · {p.barcode ?? "no code"}
                        </div>
                      </div>
                      {qty > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setQty(p.id, qty - 1)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-surface-border text-ink-muted hover:bg-surface-muted"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">
                            {qty}
                          </span>
                          <button
                            onClick={() => setQty(p.id, qty + 1)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-surface-border text-ink-muted hover:bg-surface-muted"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setQty(p.id, 1)}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-faint">
                    No products found.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Format options */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <div className="mb-2 text-sm font-medium text-ink">
                  Label format
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormatButton
                    active={format === "sheet"}
                    onClick={() => setFormat("sheet")}
                    icon={LayoutGrid}
                    label="Sheet"
                    hint="A4 / Letter grid"
                  />
                  <FormatButton
                    active={format === "roll"}
                    onClick={() => setFormat("roll")}
                    icon={Rows3}
                    label="Roll"
                    hint="Thermal single column"
                  />
                </div>
              </div>

              {format === "sheet" && (
                <div>
                  <div className="mb-1.5 text-sm font-medium text-ink">
                    Columns per row
                  </div>
                  <Select
                    value={String(columns)}
                    onChange={(e) => setColumns(Number(e.target.value))}
                    options={[
                      { value: "2", label: "2 columns" },
                      { value: "3", label: "3 columns (recommended)" },
                      { value: "4", label: "4 columns" },
                    ]}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={(e) => setShowName(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  Show product name
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  Show price
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-surface-border pt-3">
                <div className="text-sm text-ink-muted">
                  {totalLabels} label{totalLabels === 1 ? "" : "s"}
                </div>
                <div className="flex gap-2">
                  {chosen.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelections({})}
                    >
                      <Trash2 className="h-4 w-4" /> Clear
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={totalLabels === 0}
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: preview / print area */}
        <div>
          <div className="mb-2 text-sm font-medium text-ink print:hidden">
            Preview
          </div>
          <div className="label-print rounded-2xl border border-surface-border bg-white p-4 print:border-0 print:p-0">
            {totalLabels === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-ink-faint">
                <Tag className="h-10 w-10 opacity-40" />
                <p className="text-sm">
                  Add products on the left to preview labels here.
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "gap-2",
                  format === "sheet" ? "grid" : "flex flex-col items-center"
                )}
                style={
                  format === "sheet"
                    ? {
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }
                    : undefined
                }
              >
                {labels.map((p, i) => (
                  <LabelCell
                    key={i}
                    product={p}
                    settings={settings}
                    showName={showName}
                    showPrice={showPrice}
                    roll={format === "roll"}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print isolation: only the label grid prints. */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          .label-print,
          .label-print * {
            visibility: visible;
          }
          .label-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .label-cell {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-brand-500 bg-brand-50"
          : "border-surface-border hover:bg-surface-muted"
      )}
    >
      <Icon
        className={cn("h-5 w-5", active ? "text-brand-700" : "text-ink-muted")}
      />
      <span
        className={cn(
          "mt-1 text-sm font-medium",
          active ? "text-brand-800" : "text-ink"
        )}
      >
        {label}
      </span>
      <span className="text-xs text-ink-faint">{hint}</span>
    </button>
  );
}

function LabelCell({
  product,
  settings,
  showName,
  showPrice,
  roll,
}: {
  product: Product;
  settings: StoreSettings;
  showName: boolean;
  showPrice: boolean;
  roll: boolean;
}) {
  return (
    <div
      className={cn(
        "label-cell flex items-center gap-3 rounded-md border border-gray-300 bg-white p-2 text-gray-900",
        roll ? "w-64" : "w-full"
      )}
    >
      <QrCode value={product.barcode ?? String(product.id)} size={64} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {settings.storeName}
        </div>
        {showName && (
          <div className="truncate text-xs font-medium leading-tight text-gray-900">
            {product.name}
          </div>
        )}
        <div className="mt-0.5 font-mono text-[10px] text-gray-500">
          {product.barcode ?? `#${product.id}`}
        </div>
        {showPrice && (
          <div className="mt-0.5 text-sm font-bold text-gray-900">
            {formatCurrency(product.unitPrice)}
          </div>
        )}
      </div>
    </div>
  );
}
