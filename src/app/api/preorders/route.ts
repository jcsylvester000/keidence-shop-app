import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toPreOrder } from "@/lib/serialize";

export const runtime = "nodejs";

function makeRef(seq: number, date: string): string {
  const compact = date.replace(/-/g, "");
  return `PO-${compact}-${String(seq).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const expectedDate = String(b.expectedDate);
  const lines: {
    productId: number | null;
    name: string;
    unitPrice: number;
    quantity: number;
  }[] = (b.lines ?? []).map((l: Record<string, unknown>) => ({
    productId: l.productId != null ? Number(l.productId) : null,
    name: String(l.name),
    unitPrice: Number(l.unitPrice),
    quantity: Number(l.quantity),
  }));

  if (!expectedDate || lines.length === 0) {
    return NextResponse.json({ error: "date and lines required" }, { status: 400 });
  }

  const seq = (await prisma.preOrder.count()) + 1;
  const created = await prisma.preOrder.create({
    data: {
      reference: makeRef(seq, expectedDate),
      clientName: String(b.clientName),
      contactNumber: String(b.contactNumber ?? ""),
      contactEmail: String(b.contactEmail ?? ""),
      socialMedia: String(b.socialMedia ?? ""),
      expectedDate,
      taxRate: Number(b.taxRate ?? 12),
      taxInclusive: Boolean(b.taxInclusive ?? true),
      notes: String(b.notes ?? ""),
      status: "PENDING",
      lines: {
        create: lines.map((l, i) => ({
          productId: l.productId,
          name: l.name,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          received: false,
          position: i,
        })),
      },
    },
    include: { lines: true },
  });
  return NextResponse.json({ preOrder: toPreOrder(created) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.preOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
