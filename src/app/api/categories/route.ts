import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toCategory } from "@/lib/serialize";

export const runtime = "nodejs";

function cleanPrefix(raw: string, name: string): string {
  return (raw || name.slice(0, 3))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const prefix = cleanPrefix(String(b.prefix ?? ""), String(b.name ?? ""));

  if (b.id) {
    const updated = await prisma.category.update({
      where: { id: Number(b.id) },
      data: { name: String(b.name), prefix },
    });
    return NextResponse.json({ category: toCategory(updated) });
  }
  const created = await prisma.category.create({
    data: { name: String(b.name), prefix },
  });
  return NextResponse.json({ category: toCategory(created) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
