import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

// Adjust stock by a signed delta and record the movement.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { productId, delta, comment } = await req.json();
  const pid = Number(productId);
  const d = Number(delta);
  if (!pid || !Number.isFinite(d)) {
    return NextResponse.json({ error: "productId and delta required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: pid } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.product.update({
      where: { id: pid },
      data: { stockQuantity: Number(product.stockQuantity) + d },
    }),
    prisma.inventoryTransaction.create({
      data: {
        productId: pid,
        userId: auth.id,
        reason: "ADJUSTMENT",
        quantityChange: d,
        comment: String(comment ?? "Manual adjustment"),
      },
    }),
  ]);

  await audit(auth, "inventory.adjust", {
    entity: "product",
    entityId: pid,
    detail: `${d >= 0 ? "+" : ""}${d} · ${product.name} · ${String(comment ?? "")}`,
  });

  return NextResponse.json({ ok: true });
}
