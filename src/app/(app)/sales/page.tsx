"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Receipt,
  ShoppingBag,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

type Range = "day" | "month" | "year";

interface Analytics {
  period: { start: string; end: string };
  summary: {
    revenue: number;
    net: number;
    vat: number;
    cost: number;
    grossProfit: number;
    margin: number;
    transactions: number;
    itemsSold: number;
    avgSale: number;
  };
  sales: {
    id: number;
    invoiceNumber: string | null;
    customerName: string;
    total: number;
    net: number;
    vat: number;
    itemCount: number;
    soldAt: string;
  }[];
}

function pad(x: number) {
  return String(x).padStart(2, "0");
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function SalesPage() {
  const [range, setRange] = useState<Range>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics?range=${range}&date=${isoDate(anchor)}`,
        { cache: "no-store" }
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  function shift(dir: number) {
    const d = new Date(anchor);
    if (range === "day") d.setDate(d.getDate() + dir);
    else if (range === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  }

  const periodLabel = useMemo(() => {
    if (range === "day")
      return anchor.toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    if (range === "month")
      return anchor.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
      });
    return String(anchor.getFullYear());
  }, [range, anchor]);

  const isFuture = useMemo(() => {
    // Don't let the user page into the future beyond the current period.
    const now = new Date();
    if (range === "day") return isoDate(anchor) >= isoDate(now);
    if (range === "month")
      return (
        anchor.getFullYear() > now.getFullYear() ||
        (anchor.getFullYear() === now.getFullYear() &&
          anchor.getMonth() >= now.getMonth())
      );
    return anchor.getFullYear() >= now.getFullYear();
  }, [range, anchor]);

  const s = data?.summary;

  const kpis = [
    {
      label: "Revenue",
      value: formatCurrency(s?.revenue ?? 0),
      sub: "gross sales",
      icon: TrendingUp,
      tone: "text-brand-600",
    },
    {
      label: "Gross profit",
      value: formatCurrency(s?.grossProfit ?? 0),
      sub: `${(s?.margin ?? 0).toFixed(1)}% margin`,
      icon: Wallet,
      tone: "text-emerald-600",
    },
    {
      label: "VAT collected",
      value: formatCurrency(s?.vat ?? 0),
      sub: "tax portion",
      icon: Receipt,
      tone: "text-amber-600",
    },
    {
      label: "Transactions",
      value: String(s?.transactions ?? 0),
      sub: `avg ${formatCurrency(s?.avgSale ?? 0)}`,
      icon: ShoppingBag,
      tone: "text-blue-600",
    },
    {
      label: "Items sold",
      value: String(s?.itemsSold ?? 0),
      sub: "units",
      icon: Package,
      tone: "text-ink-muted",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Sales</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Track daily, monthly, and yearly sales — revenue, profit, and tax due.
        </p>
      </div>

      {/* Range toggle + period nav */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
          {(["day", "month", "year"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                range === r
                  ? "bg-brand-600 text-white"
                  : "text-ink-muted hover:bg-surface-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-surface-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[180px] text-center text-sm font-medium text-ink">
            {periodLabel}
          </div>
          <button
            onClick={() => shift(1)}
            disabled={isFuture}
            className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-surface-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!(
            range === "day" && isoDate(anchor) === isoDate(new Date())
          ) && (
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">{k.label}</span>
                  <Icon className={cn("h-4 w-4", k.tone)} />
                </div>
                <div className="mt-2 text-xl font-semibold text-ink">
                  {loading ? "…" : k.value}
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">{k.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales list for the period */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="font-semibold text-ink">Transactions</h2>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
          )}
        </div>
        {!loading && (data?.sales.length ?? 0) === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">
            No sales in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium text-ink-muted">
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5 text-center">Items</th>
                <th className="px-4 py-2.5 text-right">VAT</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(data?.sales ?? []).map((sale) => (
                <tr key={sale.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">
                    {sale.invoiceNumber ?? `#${sale.id}`}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{sale.customerName}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {new Date(sale.soldAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-center text-ink-muted">
                    {sale.itemCount}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-muted">
                    {formatCurrency(sale.vat)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-ink">
                    {formatCurrency(sale.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {(data?.sales.length ?? 0) >= 100 && (
        <p className="mt-2 text-xs text-ink-faint">
          Showing the 100 most recent transactions in this period.
        </p>
      )}
    </div>
  );
}
