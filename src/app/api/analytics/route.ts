import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Analytics aggregation. One endpoint powers both the Sales page and the
// Analytics page. Query params:
//   ?range=day|month|year   (default month)
//   ?date=YYYY-MM-DD        (anchor within the range; default today)
//
// Everything is computed server-side against Postgres so it reflects ALL
// sales, not just the last-200 the client cache holds. Profit uses each sale
// line's unitPrice vs the product's current cost price.
// ---------------------------------------------------------------------------

function n(v: unknown): number {
  if (v == null) return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof v === "number" ? v : Number((v as any).toString());
}

function pad(x: number) {
  return String(x).padStart(2, "0");
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compute [start, end) Date bounds for a range anchored on `date`. */
function bounds(range: string, date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (range === "day") {
    end.setDate(end.getDate() + 1);
  } else if (range === "year") {
    start.setMonth(0, 1);
    end.setFullYear(start.getFullYear() + 1, 0, 1);
  } else {
    // month
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 1);
  }
  return { start, end };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "month";
  const dateParam = url.searchParams.get("date");
  const anchor = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
  const { start, end } = bounds(range, anchor);

  // --- Pull the sales in range with their items + payments ---
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: start, lt: end } },
    include: { items: true, payments: true },
    orderBy: { soldAt: "desc" },
  });

  // Product cost lookup (for profit).
  const products = await prisma.product.findMany({
    select: { id: true, costPrice: true, category: true, name: true },
  });
  const costById = new Map<number, number>();
  const catById = new Map<number, string>();
  const nameById = new Map<number, string>();
  for (const p of products) {
    costById.set(p.id, n(p.costPrice));
    catById.set(p.id, p.category || "Uncategorized");
    nameById.set(p.id, p.name);
  }

  // --- Roll up totals ---
  let revenue = 0;
  let net = 0;
  let vat = 0;
  let cost = 0;
  let itemsSold = 0;
  const byDay = new Map<string, { revenue: number; profit: number; txns: number }>();
  const byProduct = new Map<
    number,
    { name: string; qty: number; revenue: number; profit: number }
  >();
  const byCategory = new Map<string, { revenue: number; qty: number }>();
  const byPayment = new Map<string, { amount: number; count: number }>();
  const byHour = new Array(24).fill(0);

  for (const s of sales) {
    const total = n(s.total);
    revenue += total;
    net += n(s.net);
    vat += n(s.taxTotal);

    const dayKey = iso(new Date(s.soldAt));
    const dayRow = byDay.get(dayKey) ?? { revenue: 0, profit: 0, txns: 0 };
    dayRow.revenue += total;
    dayRow.txns += 1;

    const hour = new Date(s.soldAt).getHours();
    byHour[hour] += 1;

    let saleCost = 0;
    for (const it of s.items) {
      const qty = n(it.quantity);
      const lineRev = n(it.lineTotal);
      const unitCost = costById.get(it.productId) ?? 0;
      const lineCost = unitCost * qty;
      saleCost += lineCost;
      itemsSold += qty;

      const prod = byProduct.get(it.productId) ?? {
        name: it.name || nameById.get(it.productId) || "Item",
        qty: 0,
        revenue: 0,
        profit: 0,
      };
      prod.qty += qty;
      prod.revenue += lineRev;
      prod.profit += lineRev - lineCost;
      byProduct.set(it.productId, prod);

      const catKey = catById.get(it.productId) ?? "Uncategorized";
      const cat = byCategory.get(catKey) ?? { revenue: 0, qty: 0 };
      cat.revenue += lineRev;
      cat.qty += qty;
      byCategory.set(catKey, cat);
    }
    cost += saleCost;
    // Gross profit = revenue − cost of goods.
    dayRow.profit += total - saleCost;
    byDay.set(dayKey, dayRow);

    for (const p of s.payments) {
      const row = byPayment.get(p.paymentType) ?? { amount: 0, count: 0 };
      row.amount += n(p.amount);
      row.count += 1;
      byPayment.set(p.paymentType, row);
    }
  }

  const grossProfit = revenue - cost;

  // --- Build a complete day/month series (fill gaps with zeros) for trends ---
  const trend: { label: string; key: string; revenue: number; profit: number; txns: number }[] = [];
  if (range === "year") {
    // 12 months
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(start.getFullYear(), m, 1);
      const mEnd = new Date(start.getFullYear(), m + 1, 1);
      let rev = 0,
        prof = 0,
        txns = 0;
      for (const [k, v] of byDay) {
        const d = new Date(k + "T00:00:00");
        if (d >= mStart && d < mEnd) {
          rev += v.revenue;
          prof += v.profit;
          txns += v.txns;
        }
      }
      trend.push({
        label: mStart.toLocaleDateString("en-PH", { month: "short" }),
        key: iso(mStart),
        revenue: rev,
        profit: prof,
        txns,
      });
    }
  } else {
    // day-by-day across the range (for "day" it's just the single day)
    const cursor = new Date(start);
    while (cursor < end) {
      const k = iso(cursor);
      const v = byDay.get(k) ?? { revenue: 0, profit: 0, txns: 0 };
      trend.push({
        label:
          range === "day"
            ? cursor.toLocaleDateString("en-PH", { weekday: "short" })
            : String(cursor.getDate()),
        key: k,
        revenue: v.revenue,
        profit: v.profit,
        txns: v.txns,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const categories = Array.from(byCategory.entries())
    .map(([name, v]) => ({ name, revenue: v.revenue, qty: v.qty }))
    .sort((a, b) => b.revenue - a.revenue);

  const payments = Array.from(byPayment.entries())
    .map(([type, v]) => ({ type, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  // --- Reservations & pre-orders in range (by created/expected date) ---
  const [reservations, preOrders] = await Promise.all([
    prisma.reservation.findMany({
      where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { source: true, hourlyRate: true, hours: true },
    }),
    prisma.preOrder.findMany({
      where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { id: true, lines: { select: { quantity: true, unitPrice: true } } },
    }),
  ]);

  let resOnline = 0,
    resInStore = 0,
    resRevenue = 0;
  for (const r of reservations) {
    if (r.source === "ONLINE") resOnline++;
    else resInStore++;
    resRevenue += n(r.hourlyRate) * (r.hours?.length ?? 0);
  }
  let preOrderValue = 0;
  for (const o of preOrders) {
    for (const l of o.lines) preOrderValue += n(l.unitPrice) * n(l.quantity);
  }

  return NextResponse.json({
    range,
    period: { start: iso(start), end: iso(new Date(end.getTime() - 86400000)) },
    summary: {
      revenue,
      net,
      vat,
      cost,
      grossProfit,
      margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      transactions: sales.length,
      itemsSold,
      avgSale: sales.length > 0 ? revenue / sales.length : 0,
    },
    trend,
    topProducts,
    categories,
    payments,
    hours: byHour,
    reservations: {
      total: reservations.length,
      online: resOnline,
      inStore: resInStore,
      revenue: resRevenue,
    },
    preOrders: { count: preOrders.length, value: preOrderValue },
    sales: sales.slice(0, 100).map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      total: n(s.total),
      net: n(s.net),
      vat: n(s.taxTotal),
      itemCount: s.items.reduce((sum, it) => sum + n(it.quantity), 0),
      soldAt: s.soldAt.toISOString(),
    })),
  });
}
