import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

function makeRef(seq: number, date: string): string {
  return `RES-${date.replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
}

function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 Sun … 6 Sat
  return day === 0 || day === 6;
}

// PUBLIC endpoint (no auth). A customer books a repair slot from the shared
// link. Server-side validation + conflict check guarantee no double-booking
// even under concurrent requests.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));

  const customerName = String(b.customerName ?? "").trim();
  const contactNumber = String(b.contactNumber ?? "").trim();
  const repairNote = String(b.repairNote ?? "").trim();
  const date = String(b.date ?? "").trim();
  const hours: number[] = Array.isArray(b.hours)
    ? b.hours.map((h: unknown) => Number(h)).filter((h: number) => Number.isFinite(h))
    : [];

  // --- Validation ---
  if (!customerName || !contactNumber) {
    return NextResponse.json(
      { error: "Please enter your name and contact number." },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || hours.length === 0) {
    return NextResponse.json(
      { error: "Please choose a date and at least one time slot." },
      { status: 400 }
    );
  }

  // Reject past dates.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = date.split("-").map(Number);
  const bookingDay = new Date(y, m - 1, d);
  if (bookingDay < today) {
    return NextResponse.json(
      { error: "That date has already passed. Please pick an upcoming day." },
      { status: 400 }
    );
  }

  // Enforce business hours for the chosen day.
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const weekend = isWeekendISO(date);
  const open = weekend
    ? settings?.repairWeekendOpen ?? 10
    : settings?.repairWeekdayOpen ?? 10;
  const close = weekend
    ? settings?.repairWeekendClose ?? 19
    : settings?.repairWeekdayClose ?? 19;
  if (hours.some((h) => h < open || h >= close)) {
    return NextResponse.json(
      { error: "One of those times is outside business hours." },
      { status: 400 }
    );
  }

  // Cap how many hours can be booked in one online request (anti-abuse).
  if (hours.length > 8) {
    return NextResponse.json(
      { error: "Please book at most 8 hours at a time." },
      { status: 400 }
    );
  }

  // --- Conflict check (authoritative) ---
  const existing = await prisma.reservation.findMany({
    where: { date, status: { not: "CANCELLED" } },
    select: { hours: true },
  });
  const taken = new Set<number>();
  for (const r of existing) for (const h of r.hours) taken.add(h);
  if (hours.some((h) => taken.has(h))) {
    return NextResponse.json(
      { error: "slot_taken" },
      { status: 409 }
    );
  }

  const rate = settings ? Number(settings.repairHourlyRate) : 150;
  const vatRate = settings ? Number(settings.defaultVatRate) : 12;
  const vatInclusive = settings?.vatInclusive ?? true;

  const seq = (await prisma.reservation.count()) + 1;
  const created = await prisma.reservation.create({
    data: {
      reference: makeRef(seq, date),
      customerName,
      contactNumber,
      contactEmail: "",
      socialMedia: "",
      date,
      hours: [...hours].sort((a, c) => a - c),
      hourlyRate: rate,
      taxRate: vatRate,
      taxInclusive: vatInclusive,
      notes: repairNote ? `Online booking — ${repairNote}` : "Online booking",
      status: "BOOKED",
      source: "ONLINE",
    },
  });

  await audit(null, "reservation.online_book", {
    entity: "reservation",
    entityId: created.id,
    detail: `${created.reference} · ${customerName} · ${date} · ${hours.length}hr · online`,
  });

  return NextResponse.json({
    ok: true,
    reference: created.reference,
    date: created.date,
    hours: created.hours,
  });
}
