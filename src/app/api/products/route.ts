import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toProduct } from "@/lib/serialize";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

// Create or update a product. Records an inventory movement when stock changes.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const data = {
    name: String(b.name),
    category: String(b.category ?? "Uncategorized"),
    barcode: b.barcode ? String(b.barcode) : null,
    description: String(b.description ?? ""),
    costPrice: Number(b.costPrice) || 0,
    unitPrice: Number(b.unitPrice) || 0,
    stockQuantity: Number(b.stockQuantity) || 0,
    reorderLevel: Number(b.reorderLevel) || 0,
    templateId: b.templateId ?? null,
  };

  if (b.id) {
    const prev = await prisma.product.findUnique({ where: { id: Number(b.id) } });
    const updated = await prisma.product.update({
      where: { id: Number(b.id) },
      data,
    });
    // Record adjustment if stock was edited directly.
    if (prev && Number(prev.stockQuantity) !== data.stockQuantity) {
      await prisma.inventoryTransaction.create({
        data: {
          productId: updated.id,
          userId: auth.id,
          reason: "ADJUSTMENT",
          quantityChange: data.stockQuantity - Number(prev.stockQuantity),
          comment: "Manual stock edit",
        },
      });
    }
    await audit(auth, "product.update", {
      entity: "product",
      entityId: updated.id,
      detail: `Edited '${updated.name}' (price ${data.unitPrice}, stock ${data.stockQuantity})`,
    });
    return NextResponse.json({ product: toProduct(updated) });
  }

  const created = await prisma.product.create({ data });
  await prisma.inventoryTransaction.create({
    data: {
      productId: created.id,
      userId: auth.id,
      reason: "INITIAL",
      quantityChange: data.stockQuantity,
      comment: "Product created",
    },
  });
  await audit(auth, "product.create", {
    entity: "product",
    entityId: created.id,
    detail: `Added '${created.name}' (${data.category})`,
  });
  return NextResponse.json({ product: toProduct(created) });
}

// Soft-delete a product.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const removed = await prisma.product.update({
    where: { id },
    data: { deleted: true },
  });
  await audit(auth, "product.delete", {
    entity: "product",
    entityId: id,
    detail: `Removed '${removed.name}'`,
  });
  return NextResponse.json({ ok: true });
}
