import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";

export const runtime = "nodejs";

type Status = "PENDING" | "ORDERING" | "READY" | "COMPLETED" | "CANCELLED";

function derive(lines: { received: boolean }[]): Status {
  if (lines.length === 0) return "PENDING";
  const received = lines.filter((l) => l.received).length;
  if (received === 0) return "PENDING";
  if (received < lines.length) return "ORDERING";
  return "READY";
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id, status } = await req.json();
  const oid = Number(id);
  let next: Status = status;

  // Re-deriving from lines when returning to an "open" state.
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    const order = await prisma.preOrder.findUnique({
      where: { id: oid },
      include: { lines: true },
    });
    if (order) next = derive(order.lines);
  }

  await prisma.preOrder.update({ where: { id: oid }, data: { status: next } });
  return NextResponse.json({ ok: true });
}
