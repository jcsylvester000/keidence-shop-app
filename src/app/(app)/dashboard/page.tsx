"use client";

import Link from "next/link";
import {
  Boxes,
  ScanLine,
  AlertTriangle,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/use-store";
import {
  getProducts,
  getLowStockProducts,
  getSales,
} from "@/data/store";
import { formatCurrency } from "@/lib/utils";
import { useSession } from "@/lib/session";

export default function DashboardPage() {
  const { user } = useSession();
  const products = useStore(() => getProducts());
  const lowStock = useStore(() => getLowStockProducts());
  const sales = useStore(() => getSales());

  const today = new Date().toDateString();
  const todaySales = sales.filter(
    (s) => new Date(s.soldAt).toDateString() === today
  );
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const stockValue = products.reduce(
    (sum, p) => sum + p.unitPrice * p.stockQuantity,
    0
  );

  const stats = [
    {
      label: "Today's sales",
      value: formatCurrency(todayRevenue),
      sub: `${todaySales.length} transaction${todaySales.length === 1 ? "" : "s"}`,
      icon: TrendingUp,
    },
    {
      label: "Products",
      value: String(products.length),
      sub: "in catalog",
      icon: Boxes,
    },
    {
      label: "Stock value",
      value: formatCurrency(stockValue),
      sub: "at retail price",
      icon: Receipt,
    },
    {
      label: "Low stock",
      value: String(lowStock.length),
      sub: "at or below reorder",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back, {user?.firstName}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Here's what's happening across the shop today.
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link href="/register">
          <Card className="group cursor-pointer transition-shadow hover:shadow-pop">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
                <ScanLine className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-ink">Open Sales Register</div>
                <div className="text-sm text-ink-muted">
                  Scan items and check out a customer
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/inventory">
          <Card className="group cursor-pointer transition-shadow hover:shadow-pop">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-ink">Manage Inventory</div>
                <div className="text-sm text-ink-muted">
                  Add products and adjust stock levels
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">{s.label}</span>
                  <Icon className="h-4 w-4 text-ink-faint" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-ink">
                  {s.value}
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">{s.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low stock */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-ink">Low stock alerts</h3>
              <Link href="/inventory">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </div>
            {lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                Everything is well stocked. 🎉
              </p>
            ) : (
              <ul className="space-y-2.5">
                {lowStock.slice(0, 6).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {p.name}
                      </div>
                      <div className="text-xs text-ink-faint">{p.category}</div>
                    </div>
                    <Badge tone={p.stockQuantity <= 0 ? "danger" : "warning"}>
                      {p.stockQuantity} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 font-semibold text-ink">Recent sales</h3>
            {sales.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                No sales yet. Open the register to make your first sale.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {sales.slice(0, 6).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {s.invoiceNumber}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {s.items.length} item
                        {s.items.length === 1 ? "" : "s"} ·{" "}
                        {new Date(s.soldAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrency(s.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
