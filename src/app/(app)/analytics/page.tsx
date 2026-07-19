"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Boxes,
  CalendarClock,
  Loader2,
  Globe,
  Store,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendChart,
  BarList,
  Donut,
  ColumnChart,
} from "@/components/charts";
import { formatCurrency, cn } from "@/lib/utils";

type Range = "day" | "month" | "year";

interface Analytics {
  range: string;
  summary: {
    revenue: number;
    grossProfit: number;
    margin: number;
    transactions: number;
    itemsSold: number;
  };
  trend: { label: string; revenue: number; profit: number; txns: number }[];
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
  categories: { name: string; revenue: number; qty: number }[];
  payments: { type: string; amount: number; count: number }[];
  hours: number[];
  reservations: {
    total: number;
    online: number;
    inStore: number;
    revenue: number;
  };
  preOrders: { count: number; value: number };
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`, {
        cache: "no-store",
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sales trends, best sellers, bookings, and traffic — at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />}
          <div className="flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
            {(["day", "month", "year"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  range === r
                    ? "bg-brand-600 text-white"
                    : "text-ink-muted hover:bg-surface-muted"
                )}
              >
                {r === "day" ? "Today" : `This ${r}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Revenue"
          value={formatCurrency(s?.revenue ?? 0)}
          icon={TrendingUp}
          tone="text-brand-600"
        />
        <Kpi
          label="Gross profit"
          value={formatCurrency(s?.grossProfit ?? 0)}
          sub={`${(s?.margin ?? 0).toFixed(1)}% margin`}
          icon={Wallet}
          tone="text-emerald-600"
        />
        <Kpi
          label="Items sold"
          value={String(s?.itemsSold ?? 0)}
          icon={Boxes}
          tone="text-blue-600"
        />
        <Kpi
          label="Repair bookings"
          value={String(data?.reservations.total ?? 0)}
          sub={`${data?.reservations.online ?? 0} online`}
          icon={CalendarClock}
          tone="text-amber-600"
        />
      </div>

      {/* Sales trend */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <h2 className="mb-1 font-semibold text-ink">
            Revenue &amp; profit over time
          </h2>
          <p className="mb-4 text-xs text-ink-muted">
            {range === "day"
              ? "Today"
              : range === "month"
                ? "By day this month"
                : "By month this year"}
          </p>
          <TrendChart data={data?.trend ?? []} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-semibold text-ink">Top products</h2>
            <BarList
              data={(data?.topProducts ?? []).map((p) => ({
                label: p.name,
                value: p.revenue,
                sub: `${p.qty} sold · ${formatCurrency(p.profit)} profit`,
              }))}
              colorIndex={0}
            />
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-semibold text-ink">Sales by category</h2>
            <BarList
              data={(data?.categories ?? []).map((c) => ({
                label: c.name,
                value: c.revenue,
                sub: `${c.qty} units`,
              }))}
              colorIndex={1}
            />
          </CardContent>
        </Card>

        {/* Payment mix */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-semibold text-ink">Payment methods</h2>
            <Donut
              data={(data?.payments ?? []).map((p) => ({
                label: p.type,
                value: p.amount,
              }))}
            />
          </CardContent>
        </Card>

        {/* Traffic by hour */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 font-semibold text-ink">Busiest hours</h2>
            <p className="mb-4 text-xs text-ink-muted">
              Transactions by hour of day (foot traffic)
            </p>
            <ColumnChart
              data={(data?.hours ?? new Array(24).fill(0))
                .map((v, h) => ({
                  label: h % 12 === 0 ? 12 : h % 12,
                  value: v,
                }))
                .slice(7, 22)
                .map((d) => ({ label: String(d.label), value: d.value }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Reservations & pre-orders */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold text-ink">
            Reservations &amp; pre-orders
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <CalendarClock className="h-4 w-4 text-brand-600" /> Repair
                reservations
              </div>
              {data && data.reservations.total > 0 ? (
                <Donut
                  size={140}
                  data={[
                    { label: "In-store", value: data.reservations.inStore },
                    { label: "Online", value: data.reservations.online },
                  ]}
                />
              ) : (
                <p className="py-4 text-sm text-ink-faint">
                  No bookings this period.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge tone="brand">
                  <Store className="h-3 w-3" /> {data?.reservations.inStore ?? 0}{" "}
                  in-store
                </Badge>
                <Badge tone="warning">
                  <Globe className="h-3 w-3" /> {data?.reservations.online ?? 0}{" "}
                  online
                </Badge>
                <Badge tone="default">
                  {formatCurrency(data?.reservations.revenue ?? 0)} value
                </Badge>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <Boxes className="h-4 w-4 text-brand-600" /> Pre-orders (batch
                sales)
              </div>
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-2xl font-semibold text-ink">
                  {data?.preOrders.count ?? 0}
                </div>
                <div className="text-sm text-ink-muted">
                  orders taken · {formatCurrency(data?.preOrders.value ?? 0)}{" "}
                  value
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">{label}</span>
          <Icon className={cn("h-4 w-4", tone)} />
        </div>
        <div className="mt-2 text-xl font-semibold text-ink">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
      </CardContent>
    </Card>
  );
}
