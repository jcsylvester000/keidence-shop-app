import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/api-guard";
import { toSettings } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ["ADMIN", "MANAGER"]);
  if (forbidden) return forbidden;

  const b = await req.json();
  // Only accept known fields.
  const data: Record<string, unknown> = {};
  const strFields = [
    "storeName", "tagline", "address1", "address2", "tin", "phone",
    "email", "website", "businessReg", "receiptFooter", "invoicePrefix",
  ];
  for (const f of strFields) if (f in b) data[f] = String(b[f]);
  if ("defaultVatRate" in b) data.defaultVatRate = Number(b.defaultVatRate);
  if ("vatInclusive" in b) data.vatInclusive = Boolean(b.vatInclusive);
  for (const f of [
    "repairWeekdayOpen", "repairWeekdayClose",
    "repairWeekendOpen", "repairWeekendClose",
  ]) {
    if (f in b) data[f] = Number(b[f]);
  }
  if ("repairHourlyRate" in b) data.repairHourlyRate = Number(b.repairHourlyRate);

  const updated = await prisma.storeSettings.update({ where: { id: 1 }, data });
  return NextResponse.json({ settings: toSettings(updated) });
}
