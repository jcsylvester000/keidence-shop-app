import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toMovement } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const productId = Number(new URL(req.url).searchParams.get("productId"));
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }
  const movements = await prisma.inventoryTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ movements: movements.map(toMovement) });
}
