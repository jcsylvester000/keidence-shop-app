import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toTemplate } from "@/lib/serialize";

export const runtime = "nodejs";

// Generate a unique product code KEI-<PREFIX>-<seq>.
async function generateCode(categoryId: number): Promise<string> {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  const prefix = cat?.prefix || "GEN";
  // Find the highest numeric suffix already used for this prefix.
  const existing = await prisma.productTemplate.findMany({
    where: { code: { startsWith: `KEI-${prefix}-` } },
    select: { code: true },
  });
  let max = 1000;
  for (const t of existing) {
    const n = parseInt(t.code.split("-").pop() || "0", 10);
    if (Number.isFinite(n) && n >= max) max = n + 1;
  }
  let code = `KEI-${prefix}-${max}`;
  // Guard against collisions across prefixes.
  while (await prisma.productTemplate.findUnique({ where: { code } })) {
    max++;
    code = `KEI-${prefix}-${max}`;
  }
  return code;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const categoryId = Number(b.categoryId);
  const base = {
    name: String(b.name),
    categoryId,
    defaultCostPrice: Number(b.defaultCostPrice) || 0,
    defaultUnitPrice: Number(b.defaultUnitPrice) || 0,
  };

  if (b.id) {
    const updated = await prisma.productTemplate.update({
      where: { id: Number(b.id) },
      data: base,
    });
    return NextResponse.json({ template: toTemplate(updated) });
  }

  const code = b.code ? String(b.code) : await generateCode(categoryId);
  const created = await prisma.productTemplate.create({
    data: { ...base, code },
  });
  return NextResponse.json({ template: toTemplate(created) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.productTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
