import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  toProduct,
  toCategory,
  toTemplate,
  toSale,
  toReservation,
  toPreOrder,
  toSettings,
} from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One call returns the full app state so the client store can hydrate in a
// single round-trip after login.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    products,
    categories,
    templates,
    sales,
    reservations,
    preOrders,
    settings,
  ] = await Promise.all([
    prisma.product.findMany({ where: { deleted: false }, orderBy: { id: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.productTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      include: { items: true, payments: true },
      orderBy: { soldAt: "desc" },
      take: 200,
    }),
    prisma.reservation.findMany({ orderBy: { date: "asc" } }),
    prisma.preOrder.findMany({ include: { lines: true }, orderBy: { expectedDate: "asc" } }),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
  ]);

  return NextResponse.json({
    products: products.map(toProduct),
    categories: categories.map(toCategory),
    templates: templates.map(toTemplate),
    sales: sales.map(toSale),
    reservations: reservations.map(toReservation),
    preOrders: preOrders.map(toPreOrder),
    settings: settings ? toSettings(settings) : null,
  });
}
