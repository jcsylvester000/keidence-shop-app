import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { toReservation } from "@/lib/serialize";

export const runtime = "nodejs";

function makeRef(seq: number, date: string): string {
  const compact = date.replace(/-/g, "");
  return `RES-${compact}-${String(seq).padStart(4, "0")}`;
}

// Create a reservation, rejecting if any requested hour is already booked.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const b = await req.json();
  const date = String(b.date);
  const hours: number[] = (b.hours ?? []).map((h: unknown) => Number(h)).sort(
    (a: number, c: number) => a - c
  );
  if (!date || hours.length === 0) {
    return NextResponse.json({ error: "date and hours required" }, { status: 400 });
  }

  // Conflict check against active reservations on that date.
  const existing = await prisma.reservation.findMany({
    where: { date, status: { not: "CANCELLED" } },
  });
  const taken = new Set<number>();
  for (const r of existing) for (const h of r.hours) taken.add(h);
  if (hours.some((h) => taken.has(h))) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const seq = (await prisma.reservation.count()) + 1;
  const created = await prisma.reservation.create({
    data: {
      reference: makeRef(seq, date),
      customerName: String(b.customerName),
      contactNumber: String(b.contactNumber ?? ""),
      contactEmail: String(b.contactEmail ?? ""),
      socialMedia: String(b.socialMedia ?? ""),
      date,
      hours,
      hourlyRate: Number(b.hourlyRate) || 0,
      taxRate: Number(b.taxRate ?? 12),
      taxInclusive: Boolean(b.taxInclusive ?? true),
      notes: String(b.notes ?? ""),
      status: "BOOKED",
    },
  });
  return NextResponse.json({ reservation: toReservation(created) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
