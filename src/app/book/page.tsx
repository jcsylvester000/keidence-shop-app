"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
} from "lucide-react";

// Public, no-login repair-booking page. Shareable link (e.g. via Messenger /
// WhatsApp). Shows open slots only; auto-refreshes every 8s so taken slots
// grey out live. Booking is instant with a server-side conflict guard.

interface Availability {
  store: { name: string; tagline: string; phone: string; address: string };
  hours: {
    weekdayOpen: number;
    weekdayClose: number;
    weekendOpen: number;
    weekendClose: number;
  };
  hourlyRate: number;
  vatRate: number;
  vatInclusive: boolean;
  booked: Record<string, number[]>;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function mondayOf(d: Date): Date {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function hourLabel(h: number): string {
  const p = h < 12 ? "AM" : "PM";
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x}${p}`;
}
function peso(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(n);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PublicBookPage() {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [selected, setSelected] = useState<{ date: string; hours: number[] }>({
    date: "",
    hours: [],
  });
  const [form, setForm] = useState({ name: "", number: "", repair: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; date: string; hours: number[] } | null>(
    null
  );

  // Anchor to this week on first client render (avoids SSR Date issues).
  useEffect(() => {
    setAnchor(mondayOf(new Date()));
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      const res = await fetch("/api/public/availability", { cache: "no-store" });
      if (res.ok) setAvail(await res.json());
    } catch {
      /* keep last-known */
    }
  }, []);

  useEffect(() => {
    loadAvailability();
    const t = setInterval(loadAvailability, 8000); // live-ish refresh
    return () => clearInterval(t);
  }, [loadAvailability]);

  const weekDays = useMemo(
    () => (anchor ? Array.from({ length: 7 }, (_, i) => addDays(anchor, i)) : []),
    [anchor]
  );

  function dayHours(d: Date) {
    if (!avail) return { open: 10, close: 19 };
    return isWeekend(d)
      ? { open: avail.hours.weekendOpen, close: avail.hours.weekendClose }
      : { open: avail.hours.weekdayOpen, close: avail.hours.weekdayClose };
  }

  const gridStart = avail
    ? Math.min(avail.hours.weekdayOpen, avail.hours.weekendOpen)
    : 10;
  const gridEnd = avail
    ? Math.max(avail.hours.weekdayClose, avail.hours.weekendClose)
    : 19;
  const slotHours = useMemo(
    () => Array.from({ length: Math.max(0, gridEnd - gridStart) }, (_, i) => gridStart + i),
    [gridStart, gridEnd]
  );

  function toggle(dateISO: string, hour: number) {
    setError(null);
    setSelected((prev) => {
      if (prev.date !== dateISO) return { date: dateISO, hours: [hour] };
      const has = prev.hours.includes(hour);
      return {
        date: dateISO,
        hours: has
          ? prev.hours.filter((h) => h !== hour)
          : [...prev.hours, hour].sort((a, b) => a - b),
      };
    });
  }

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.number.trim()) {
      setError("Please enter your name and contact number.");
      return;
    }
    if (!selected.date || selected.hours.length === 0) {
      setError("Please pick a date and at least one time slot.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          contactNumber: form.number,
          repairNote: form.repair,
          date: selected.date,
          hours: selected.hours,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(
          "Sorry — one of those slots was just taken. The calendar has been refreshed; please pick another."
        );
        setSelected({ date: "", hours: [] });
        loadAvailability();
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setDone({ reference: data.reference, date: data.date, hours: data.hours });
    } catch {
      setError("Couldn't reach the shop. Please check your connection.");
      setSubmitting(false);
    }
  }

  const rate = avail?.hourlyRate ?? 0;
  const total = rate * selected.hours.length;

  // --- Success screen ---
  if (done) {
    const [y, m, d] = done.date.split("-").map(Number);
    const niceDate = new Date(y, m - 1, d).toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const start = hourLabel(done.hours[0]);
    const end = hourLabel(done.hours[done.hours.length - 1] + 1);
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-800 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re booked!</h1>
          <p className="mt-2 text-gray-600">
            Thanks, {form.name.split(" ")[0]}. Your repair slot is reserved.
          </p>
          <div className="mt-5 rounded-xl bg-gray-50 p-4 text-left text-sm">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Reference</span>
              <span className="font-semibold text-gray-900">{done.reference}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 py-2">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{niceDate}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-gray-500">Time</span>
              <span className="font-medium text-gray-900">
                {start} – {end} ({done.hours.length} hr)
              </span>
            </div>
          </div>
          <p className="mt-5 text-sm text-gray-500">
            Please arrive on time. The shop may contact you at the number you
            provided. See you soon!
          </p>
          <button
            onClick={() => {
              setDone(null);
              setSelected({ date: "", hours: [] });
              setForm({ name: "", number: "", repair: "" });
              loadAvailability();
            }}
            className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
          >
            Book another slot
          </button>
        </div>
      </div>
    );
  }

  const weekLabel =
    weekDays.length === 7
      ? `${weekDays[0].toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        })} – ${weekDays[6].toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        })}`
      : "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / greeting */}
      <header className="bg-brand-800 px-4 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="5.5" cy="17.5" r="3.5" />
                <circle cx="18.5" cy="17.5" r="3.5" />
                <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold">
                {avail?.store.name ?? "Keidence"}
              </div>
              {avail?.store.tagline && (
                <div className="text-sm text-brand-100">{avail.store.tagline}</div>
              )}
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">
            Book our repair space 🔧
          </h1>
          <p className="mt-2 max-w-2xl text-brand-100">
            Pick an open day and time to reserve the shop&apos;s repair space and
            tools. Choose your slot below — taken times update live, so what you
            see is what&apos;s available.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-brand-100">
            {avail && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {peso(avail.hourlyRate)}/hour · 1-hour
                minimum
              </span>
            )}
            {avail?.store.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {avail.store.address}
              </span>
            )}
            {avail?.store.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> {avail.store.phone}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {!avail ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading availability…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Calendar */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => anchor && setAnchor(addDays(anchor, -7))}
                    disabled={
                      !anchor || toISO(anchor) <= toISO(mondayOf(new Date()))
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => anchor && setAnchor(addDays(anchor, 7))}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <CalendarDays className="h-4 w-4 text-brand-600" />
                  {weekLabel}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="w-12 border-b border-gray-200 bg-gray-50 p-2 text-xs text-gray-400">
                          <Clock className="mx-auto h-4 w-4" />
                        </th>
                        {weekDays.map((d, i) => {
                          const isToday = toISO(d) === toISO(new Date());
                          return (
                            <th
                              key={i}
                              className="border-b border-l border-gray-200 bg-gray-50 p-2 text-center"
                            >
                              <div className="text-xs text-gray-500">{DOW[i]}</div>
                              <div
                                className={
                                  "text-sm font-semibold " +
                                  (isToday ? "text-brand-700" : "text-gray-900")
                                }
                              >
                                {d.getDate()}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {slotHours.map((h) => (
                        <tr key={h}>
                          <td className="border-b border-gray-200 p-1 text-center text-[11px] font-medium text-gray-400">
                            {hourLabel(h)}
                          </td>
                          {weekDays.map((d, di) => {
                            const dateISO = toISO(d);
                            const { open, close } = dayHours(d);
                            const closed = h < open || h >= close;
                            const taken = (avail.booked[dateISO] ?? []).includes(h);
                            const isSel =
                              selected.date === dateISO &&
                              selected.hours.includes(h);
                            const past =
                              new Date(dateISO + "T23:59:59") < new Date() &&
                              toISO(new Date()) !== dateISO;
                            return (
                              <td
                                key={di}
                                className="border-b border-l border-gray-200 p-0.5"
                              >
                                {closed ? (
                                  <div className="h-9 w-full rounded-md bg-gray-50" />
                                ) : (
                                  <button
                                    disabled={taken || past}
                                    onClick={() => toggle(dateISO, h)}
                                    className={
                                      "h-9 w-full rounded-md border text-[11px] font-medium transition-colors " +
                                      (taken
                                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300"
                                        : past
                                          ? "cursor-not-allowed border-transparent bg-gray-50 text-gray-300"
                                          : isSel
                                            ? "border-brand-600 bg-brand-600 text-white"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")
                                    }
                                  >
                                    {taken ? "Taken" : isSel ? "✓" : "Open"}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-emerald-50" /> Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-brand-600" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-gray-100" /> Taken
                </span>
              </div>
            </div>

            {/* Booking form */}
            <div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900">Your details</h2>

                {error && (
                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Contact number
                    </label>
                    <input
                      value={form.number}
                      onChange={(e) =>
                        setForm({ ...form, number: e.target.value })
                      }
                      placeholder="09xx xxx xxxx"
                      inputMode="tel"
                      className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      What are you repairing?
                    </label>
                    <textarea
                      value={form.repair}
                      onChange={(e) =>
                        setForm({ ...form, repair: e.target.value })
                      }
                      placeholder="e.g. Bottom bracket replacement, brake bleed…"
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">
                    Selected slot
                  </div>
                  {selected.hours.length === 0 ? (
                    <p className="mt-1 text-sm text-gray-400">
                      Tap open times on the calendar.
                    </p>
                  ) : (
                    <>
                      <div className="mt-1 text-sm font-medium text-gray-900">
                        {new Date(
                          selected.date + "T00:00"
                        ).toLocaleDateString("en-PH", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selected.hours.map((h) => (
                          <span
                            key={h}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                          >
                            {hourLabel(h)}–{hourLabel(h + 1)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
                        <span className="text-gray-500">
                          {selected.hours.length} hr × {peso(rate)}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {peso(total)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={submit}
                  disabled={submitting || selected.hours.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Booking…" : "Confirm booking"}
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Availability updates automatically. No account needed.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
