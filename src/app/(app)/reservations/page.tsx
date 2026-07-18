"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  FileText,
  FileType,
  Settings2,
  Check,
  X,
  Trash2,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/use-store";
import {
  getSettings,
  updateSettings,
  getBookedHours,
  createReservation,
  getReservations,
  updateReservationStatus,
  deleteReservation,
} from "@/data/store";
import { formatCurrency, computeVat, cn } from "@/lib/utils";
import {
  downloadReservationPdf,
  downloadReservationDocx,
  slotSummary,
} from "@/lib/reservation-docs";
import type { Reservation } from "@/lib/types";

// ---- date helpers ---------------------------------------------------------

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `d`. */
function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ReservationsPage() {
  const settings = useStore(() => getSettings());
  const reservations = useStore(() => getReservations());

  // We need a stable "today" for week navigation. Compute once per render from
  // a state anchor so the calendar is deterministic.
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState<{ date: string; hours: number[] }>({
    date: "",
    hours: [],
  });
  const [form, setForm] = useState({
    customerName: "",
    contactNumber: "",
    contactEmail: "",
    socialMedia: "",
    notes: "",
  });
  const [rate, setRate] = useState<number>(settings.repairHourlyRate);
  const [hoursEditor, setHoursEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justBooked, setJustBooked] = useState<Reservation | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)),
    [anchor]
  );

  // Weekend = Sat (index 5) & Sun (index 6) in our Mon-first week.
  function isWeekend(d: Date) {
    const day = d.getDay(); // 0 = Sun … 6 = Sat
    return day === 0 || day === 6;
  }
  function dayHours(d: Date): { open: number; close: number } {
    return isWeekend(d)
      ? { open: settings.repairWeekendOpen, close: settings.repairWeekendClose }
      : { open: settings.repairWeekdayOpen, close: settings.repairWeekdayClose };
  }

  // The grid's rows span the union of weekday + weekend ranges so every day
  // renders; cells outside a given day's own hours show as "closed".
  const gridStart = Math.min(
    settings.repairWeekdayOpen,
    settings.repairWeekendOpen
  );
  const gridEnd = Math.max(
    settings.repairWeekdayClose,
    settings.repairWeekendClose
  );
  const slotHours = useMemo(
    () =>
      Array.from({ length: Math.max(0, gridEnd - gridStart) }, (_, i) =>
        gridStart + i
      ),
    [gridStart, gridEnd]
  );

  function toggleSlot(dateISO: string, hour: number) {
    setError(null);
    setSelected((prev) => {
      // Selecting a slot on a different day resets the selection to that day.
      if (prev.date !== dateISO) return { date: dateISO, hours: [hour] };
      const has = prev.hours.includes(hour);
      const hours = has
        ? prev.hours.filter((h) => h !== hour)
        : [...prev.hours, hour].sort((a, b) => a - b);
      return { date: dateISO, hours };
    });
  }

  const lineSubtotal = rate * selected.hours.length;
  const vat = computeVat(
    lineSubtotal,
    settings.defaultVatRate,
    settings.vatInclusive
  );

  function book() {
    setError(null);
    if (!form.customerName.trim()) {
      setError("Please enter the customer's name.");
      return;
    }
    if (!selected.date || selected.hours.length === 0) {
      setError("Please pick at least one open slot (1-hour minimum).");
      return;
    }
    const res = createReservation({
      ...form,
      customerName: form.customerName.trim(),
      date: selected.date,
      hours: selected.hours,
      hourlyRate: rate,
      taxRate: settings.defaultVatRate,
      taxInclusive: settings.vatInclusive,
    });
    if (!res) {
      setError("One of those slots was just taken. Please re-check the calendar.");
      return;
    }
    setJustBooked(res);
    setSelected({ date: "", hours: [] });
    setForm({
      customerName: "",
      contactNumber: "",
      contactEmail: "",
      socialMedia: "",
      notes: "",
    });
  }

  const weekLabel = `${weekDays[0].toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  })} – ${weekDays[6].toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="mx-auto max-w-7xl p-5 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Repair Space Reservations
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Book the repair space + tools by the hour. {formatCurrency(rate)}/hr
            · 1-hour minimum.
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Mon–Fri {hourLabel(settings.repairWeekdayOpen)}–
            {hourLabel(settings.repairWeekdayClose)} · Sat–Sun{" "}
            {hourLabel(settings.repairWeekendOpen)}–
            {hourLabel(settings.repairWeekendClose)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setHoursEditor(true)}>
          <Settings2 className="h-4 w-4" /> Hours &amp; rate
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Calendar */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnchor(addDays(anchor, -7))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-surface-muted"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAnchor(addDays(anchor, 7))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-surface-muted"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAnchor(mondayOf(new Date()))}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
              >
                This week
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              {weekLabel}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-16 border-b border-surface-border bg-surface-muted p-2 text-xs font-medium text-ink-faint">
                      <Clock className="mx-auto h-4 w-4" />
                    </th>
                    {weekDays.map((d, i) => {
                      const isToday = toISO(d) === toISO(new Date());
                      return (
                        <th
                          key={i}
                          className="border-b border-l border-surface-border bg-surface-muted p-2 text-center"
                        >
                          <div className="text-xs font-medium text-ink-muted">
                            {DOW[i]}
                          </div>
                          <div
                            className={cn(
                              "text-sm font-semibold",
                              isToday ? "text-brand-700" : "text-ink"
                            )}
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
                      <td className="border-b border-surface-border p-1 text-center align-middle text-[11px] font-medium text-ink-faint">
                        {hourLabel(h)}
                      </td>
                      {weekDays.map((d, di) => {
                        const dateISO = toISO(d);
                        const { open, close } = dayHours(d);
                        // Hour falls outside this day's business hours.
                        const closed = h < open || h >= close;
                        const booked = getBookedHours(dateISO);
                        const taken = booked.get(h);
                        const isSelected =
                          selected.date === dateISO &&
                          selected.hours.includes(h);
                        const past =
                          new Date(dateISO + "T23:59:59") < new Date() &&
                          toISO(new Date()) !== dateISO;

                        return (
                          <td
                            key={di}
                            className="border-b border-l border-surface-border p-0.5"
                          >
                            {closed ? (
                              <div
                                className="h-9 w-full rounded-md bg-surface-muted/40"
                                title="Closed"
                              />
                            ) : (
                              <button
                                disabled={!!taken || past}
                                onClick={() => toggleSlot(dateISO, h)}
                                title={
                                  taken
                                    ? `Reserved — ${taken.customerName}`
                                    : `${hourLabel(h)} open`
                                }
                                className={cn(
                                  "h-9 w-full rounded-md border text-[11px] font-medium transition-colors",
                                  taken
                                    ? "cursor-not-allowed border-red-200 bg-red-100 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                                    : past
                                      ? "cursor-not-allowed border-transparent bg-surface-muted/50 text-ink-faint/40"
                                      : isSelected
                                        ? "border-brand-600 bg-brand-600 text-white"
                                        : "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                )}
                              >
                                {taken
                                  ? taken.customerName.split(" ")[0]
                                  : isSelected
                                    ? "✓"
                                    : "Open"}
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
          </Card>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
            <Legend
              className="bg-emerald-100 dark:bg-emerald-950/40"
              label="Open"
            />
            <Legend className="bg-brand-600" label="Selected" />
            <Legend
              className="bg-red-100 dark:bg-red-950/40"
              label="Reserved"
            />
            <Legend className="bg-surface-muted/60" label="Closed" />
          </div>
        </div>

        {/* Booking form */}
        <div>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <User className="h-4 w-4 text-brand-600" /> Customer details
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  placeholder="Customer name"
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact number</Label>
                  <Input
                    value={form.contactNumber}
                    onChange={(e) =>
                      setForm({ ...form, contactNumber: e.target.value })
                    }
                    placeholder="09xx xxx xxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                    placeholder="name@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Social media page</Label>
                  <Input
                    value={form.socialMedia}
                    onChange={(e) =>
                      setForm({ ...form, socialMedia: e.target.value })
                    }
                    placeholder="FB / IG handle or link"
                  />
                </div>
              </div>

              {/* Selection summary */}
              <div className="rounded-xl border border-surface-border bg-surface-muted p-3">
                <div className="mb-1 text-xs font-medium text-ink-muted">
                  Selected slots
                </div>
                {selected.hours.length === 0 ? (
                  <p className="text-sm text-ink-faint">
                    Pick open slots on the calendar.
                  </p>
                ) : (
                  <>
                    <div className="text-sm font-medium text-ink">
                      {new Date(selected.date + "T00:00").toLocaleDateString(
                        "en-PH",
                        { weekday: "long", month: "short", day: "numeric" }
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selected.hours.map((h) => (
                        <Badge key={h} tone="brand">
                          {hourLabel(h)}–{hourLabel(h + 1)}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Rate + total */}
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Rate / hr</Label>
                <Input
                  type="number"
                  value={String(rate)}
                  onChange={(e) =>
                    setRate(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1 border-t border-surface-border pt-3 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>
                    {selected.hours.length} hr
                    {selected.hours.length === 1 ? "" : "s"} ×{" "}
                    {formatCurrency(rate)}
                  </span>
                  <span>{formatCurrency(lineSubtotal)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>
                    VAT ({settings.defaultVatRate}%
                    {settings.vatInclusive ? ", incl." : ""})
                  </span>
                  <span>{formatCurrency(vat.vat)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-ink">
                  <span>Total</span>
                  <span>{formatCurrency(vat.grandTotal)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={book}
                disabled={selected.hours.length === 0}
              >
                <CalendarCheck className="h-5 w-5" /> Book reservation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bookings list */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Reservations</h2>
        {reservations.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-faint">
              No reservations yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reservations
              .filter((r) => r.status !== "CANCELLED")
              .map((r) => (
                <ReservationRow key={r.id} reservation={r} />
              ))}
          </div>
        )}
      </div>

      {hoursEditor && (
        <HoursModal onClose={() => setHoursEditor(false)} />
      )}
      {justBooked && (
        <BookedModal
          reservation={justBooked}
          onClose={() => setJustBooked(null)}
        />
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", className)} />
      {label}
    </span>
  );
}

// --- Reservation row with document actions ---------------------------------

function ReservationRow({ reservation: r }: { reservation: Reservation }) {
  const settings = useStore(() => getSettings());
  const [busy, setBusy] = useState<string | null>(null);

  async function gen(
    fn: typeof downloadReservationPdf | typeof downloadReservationDocx,
    kind: "invoice" | "receipt",
    key: string
  ) {
    setBusy(key);
    try {
      await fn(r, settings, kind);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{r.customerName}</span>
            <Badge tone={r.status === "COMPLETED" ? "success" : "brand"}>
              {r.status.toLowerCase()}
            </Badge>
          </div>
          <div className="text-xs text-ink-muted">
            {r.reference} ·{" "}
            {new Date(r.date + "T00:00").toLocaleDateString("en-PH", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {slotSummary(r)}
          </div>
          {(r.contactNumber || r.contactEmail) && (
            <div className="text-xs text-ink-faint">
              {[r.contactNumber, r.contactEmail].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="font-semibold text-ink">
            {formatCurrency(
              computeVat(
                r.hourlyRate * r.hours.length,
                r.taxRate,
                r.taxInclusive
              ).grandTotal
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <DocBtn
            label="Invoice PDF"
            icon={FileText}
            busy={busy === "ipdf"}
            onClick={() => gen(downloadReservationPdf, "invoice", "ipdf")}
          />
          <DocBtn
            label="Invoice DOCX"
            icon={FileType}
            busy={busy === "idoc"}
            onClick={() => gen(downloadReservationDocx, "invoice", "idoc")}
          />
          <DocBtn
            label="Receipt PDF"
            icon={FileText}
            busy={busy === "rpdf"}
            onClick={() => gen(downloadReservationPdf, "receipt", "rpdf")}
          />
          <DocBtn
            label="Receipt DOCX"
            icon={FileType}
            busy={busy === "rdoc"}
            onClick={() => gen(downloadReservationDocx, "receipt", "rdoc")}
          />
          {r.status === "BOOKED" && (
            <button
              title="Mark completed"
              onClick={() => updateReservationStatus(r.id, "COMPLETED")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          <button
            title="Cancel / remove"
            onClick={() => deleteReservation(r.id)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocBtn({
  label,
  icon: Icon,
  onClick,
  busy,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {busy ? "…" : label}
    </button>
  );
}

// --- Hours & rate editor ---------------------------------------------------

function HoursModal({ onClose }: { onClose: () => void }) {
  const settings = useStore(() => getSettings());
  const [wdOpen, setWdOpen] = useState(settings.repairWeekdayOpen);
  const [wdClose, setWdClose] = useState(settings.repairWeekdayClose);
  const [weOpen, setWeOpen] = useState(settings.repairWeekendOpen);
  const [weClose, setWeClose] = useState(settings.repairWeekendClose);
  const [rate, setRate] = useState(settings.repairHourlyRate);
  const [err, setErr] = useState<string | null>(null);

  const hourField = (
    label: string,
    value: number,
    setter: (n: number) => void,
    min: number,
    max: number
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={String(value)}
        onChange={(e) => setter(parseInt(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <ModalShell title="Business hours & rate" onClose={onClose}>
      <div className="space-y-5 p-5">
        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* Weekdays */}
        <div className="rounded-xl border border-surface-border p-4">
          <div className="mb-3 text-sm font-semibold text-ink">
            Weekdays · Monday – Friday
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hourField("Opens (24h)", wdOpen, setWdOpen, 0, 23)}
            {hourField("Closes (24h)", wdClose, setWdClose, 1, 24)}
          </div>
        </div>

        {/* Weekend */}
        <div className="rounded-xl border border-surface-border p-4">
          <div className="mb-3 text-sm font-semibold text-ink">
            Weekend · Saturday – Sunday
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hourField("Opens (24h)", weOpen, setWeOpen, 0, 23)}
            {hourField("Closes (24h)", weClose, setWeClose, 1, 24)}
          </div>
        </div>

        <p className="text-xs text-ink-faint">
          E.g. opens 10, closes 19 = 10:00 AM to 7:00 PM.
        </p>

        <div className="space-y-1.5">
          <Label>Rental rate per hour (space + tools)</Label>
          <Input
            type="number"
            value={String(rate)}
            onChange={(e) => setRate(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (wdClose <= wdOpen) {
              setErr("Weekday closing hour must be after its opening hour.");
              return;
            }
            if (weClose <= weOpen) {
              setErr("Weekend closing hour must be after its opening hour.");
              return;
            }
            updateSettings({
              repairWeekdayOpen: wdOpen,
              repairWeekdayClose: wdClose,
              repairWeekendOpen: weOpen,
              repairWeekendClose: weClose,
              repairHourlyRate: rate,
            });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </ModalShell>
  );
}

// --- Just-booked confirmation with quick document actions ------------------

function BookedModal({
  reservation: r,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const settings = useStore(() => getSettings());
  const [busy, setBusy] = useState<string | null>(null);

  async function gen(
    fn: typeof downloadReservationPdf | typeof downloadReservationDocx,
    kind: "invoice" | "receipt",
    key: string
  ) {
    setBusy(key);
    try {
      await fn(r, settings, kind);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ModalShell title="Reservation booked" onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <div className="font-semibold text-ink">{r.reference}</div>
          <div className="text-sm text-ink-muted">
            {r.customerName} ·{" "}
            {new Date(r.date + "T00:00").toLocaleDateString("en-PH", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-sm text-ink-muted">{slotSummary(r)}</div>
        </div>

        <div className="rounded-xl bg-surface-muted p-3 text-center">
          <div className="text-xs text-ink-muted">Total</div>
          <div className="text-2xl font-semibold text-ink">
            {formatCurrency(
              computeVat(
                r.hourlyRate * r.hours.length,
                r.taxRate,
                r.taxInclusive
              ).grandTotal
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-ink">
            Generate document
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => gen(downloadReservationPdf, "invoice", "ipdf")}
              disabled={busy === "ipdf"}
            >
              <FileText className="h-4 w-4" /> Invoice PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => gen(downloadReservationDocx, "invoice", "idoc")}
              disabled={busy === "idoc"}
            >
              <FileType className="h-4 w-4" /> Invoice Word
            </Button>
            <Button
              variant="outline"
              onClick={() => gen(downloadReservationPdf, "receipt", "rpdf")}
              disabled={busy === "rpdf"}
            >
              <FileText className="h-4 w-4" /> Receipt PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => gen(downloadReservationDocx, "receipt", "rdoc")}
              disabled={busy === "rdoc"}
            >
              <FileType className="h-4 w-4" /> Receipt Word
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-surface-border p-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-surface shadow-pop">
        <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
