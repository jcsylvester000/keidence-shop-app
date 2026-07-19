import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC endpoint (no auth). Returns everything the public booking page needs:
// store name/greeting info, business hours + rate, and — critically — only the
// set of already-booked hours per date. It NEVER returns customer names or any
// personal info, so it's safe to expose.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Optional date range: ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to a wide
  // window so the client can page through weeks.
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });

  const where: {
    status: { not: "CANCELLED" };
    date?: { gte?: string; lte?: string };
  } = { status: { not: "CANCELLED" } };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: { date: true, hours: true },
  });

  // Aggregate booked hours per date. No PII leaves the server.
  const booked: Record<string, number[]> = {};
  for (const r of reservations) {
    if (!booked[r.date]) booked[r.date] = [];
    booked[r.date].push(...r.hours);
  }

  return NextResponse.json({
    store: {
      name: settings?.storeName ?? "Keidence",
      tagline: settings?.tagline ?? "",
      phone: settings?.phone ?? "",
      address: [settings?.address1, settings?.address2]
        .filter(Boolean)
        .join(", "),
    },
    hours: {
      weekdayOpen: settings?.repairWeekdayOpen ?? 10,
      weekdayClose: settings?.repairWeekdayClose ?? 19,
      weekendOpen: settings?.repairWeekendOpen ?? 10,
      weekendClose: settings?.repairWeekendClose ?? 19,
    },
    hourlyRate: settings ? Number(settings.repairHourlyRate) : 150,
    vatRate: settings ? Number(settings.defaultVatRate) : 12,
    vatInclusive: settings?.vatInclusive ?? true,
    booked,
  });
}
