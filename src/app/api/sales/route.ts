import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toSale } from "@/lib/serialize";
import { computeVat, makeInvoiceNumber } from "@/lib/utils";

export const runtime = "nodejs";

// Complete a sale: write header/items/payments, record SALE inventory
// movements, and decrement product stock — all in one transaction.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const lines: {
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
  }[] = (b.lines ?? []).map((l: Record<string, unknown>) => ({
    productId: Number(l.productId),
    name: String(l.name),
    unitPrice: Number(l.unitPrice),
    quantity: Number(l.quantity),
  }));

  if (lines.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const taxRate = Number(b.taxRate ?? 12);
  const taxInclusive = Boolean(b.taxInclusive ?? true);
  const vat = computeVat(subtotal, taxRate, taxInclusive);

  // Sequence for the invoice number = count of sales today + 1.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await prisma.sale.count({
    where: { soldAt: { gte: startOfDay } },
  });
  const invoiceNumber = makeInvoiceNumber(todayCount + 1);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        invoiceNumber,
        userId: auth.id,
        customerName: String(b.customerName ?? "Walk-in"),
        subtotal,
        net: vat.net,
        taxRate,
        taxInclusive,
        taxTotal: vat.vat,
        total: vat.grandTotal,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.unitPrice * l.quantity,
          })),
        },
        payments: {
          create: (b.payments ?? []).map((p: Record<string, unknown>) => ({
            paymentType: String(p.paymentType),
            amount: Number(p.amount),
          })),
        },
      },
      include: { items: true, payments: true },
    });

    // Decrement stock + ledger per line.
    for (const l of lines) {
      const product = await tx.product.findUnique({ where: { id: l.productId } });
      if (product) {
        await tx.product.update({
          where: { id: l.productId },
          data: { stockQuantity: Number(product.stockQuantity) - l.quantity },
        });
        await tx.inventoryTransaction.create({
          data: {
            productId: l.productId,
            userId: auth.id,
            reason: "SALE",
            quantityChange: -l.quantity,
            comment: `Sale ${invoiceNumber}`,
            saleId: created.id,
          },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ sale: toSale(sale) });
}
