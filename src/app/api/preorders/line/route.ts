import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toPreOrder } from "@/lib/serialize";

export const runtime = "nodejs";

type Status = "PENDING" | "ORDERING" | "READY" | "COMPLETED" | "CANCELLED";

function derive(lines: { received: boolean }[], current: Status): Status {
  if (current === "COMPLETED" || current === "CANCELLED") return current;
  const total = lines.length;
  if (total === 0) return "PENDING";
  const received = lines.filter((l) => l.received).length;
  if (received === 0) return "PENDING";
  if (received < total) return "ORDERING";
  return "READY";
}

// Toggle a single line's received flag (by lineIndex = position) and
// re-derive the order status. Returns the full updated order.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { orderId, lineIndex, received } = await req.json();
  const oid = Number(orderId);
  const idx = Number(lineIndex);

  const order = await prisma.preOrder.findUnique({
    where: { id: oid },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const line = order.lines[idx];
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

  await prisma.preOrderLine.update({
    where: { id: line.id },
    data: { received: Boolean(received) },
  });

  // Re-fetch lines to derive status.
  const freshLines = order.lines.map((l, i) =>
    i === idx ? { received: Boolean(received) } : { received: l.received }
  );
  const nextStatus = derive(freshLines, order.status as Status);

  const updated = await prisma.preOrder.update({
    where: { id: oid },
    data: { status: nextStatus },
    include: { lines: true },
  });

  return NextResponse.json({ preOrder: toPreOrder(updated) });
}
