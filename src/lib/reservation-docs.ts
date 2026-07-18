"use client";

// Client-side document generation for repair-space reservations.
// PDF via jsPDF, Word (.docx) via the `docx` library. Both are dynamically
// imported so they never load on the server or bloat the initial bundle.

import type { Reservation, StoreSettings } from "@/lib/types";
import { computeVat, formatCurrency } from "@/lib/utils";

type DocKind = "invoice" | "receipt";

function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

/** Human summary of booked hours, e.g. "10:00 AM – 12:00 PM (2 hrs)". */
export function slotSummary(r: Reservation): string {
  if (r.hours.length === 0) return "—";
  const sorted = [...r.hours].sort((a, b) => a - b);
  const start = sorted[0];
  const end = sorted[sorted.length - 1] + 1;
  return `${hourLabel(start)} – ${hourLabel(end)} (${r.hours.length} hr${
    r.hours.length === 1 ? "" : "s"
  })`;
}

interface Amounts {
  net: number;
  vat: number;
  total: number;
  lineSubtotal: number;
}

function amounts(r: Reservation): Amounts {
  const lineSubtotal = r.hourlyRate * r.hours.length;
  const v = computeVat(lineSubtotal, r.taxRate, r.taxInclusive);
  return { net: v.net, vat: v.vat, total: v.grandTotal, lineSubtotal };
}

function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---- PDF ------------------------------------------------------------------

export async function downloadReservationPdf(
  r: Reservation,
  settings: StoreSettings,
  kind: DocKind
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const a = amounts(r);
  const left = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize?.(18);
  doc.setFontSize(18);
  doc.text(settings.storeName, left, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const headerLines = [
    settings.tagline,
    [settings.address1, settings.address2].filter(Boolean).join(", "),
    [settings.phone, settings.email].filter(Boolean).join(" · "),
    settings.tin ? `TIN: ${settings.tin}` : "",
  ].filter(Boolean);
  for (const line of headerLines) {
    doc.text(line, left, y);
    y += 12;
  }

  // Title block
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const title =
    kind === "invoice" ? "REPAIR SPACE INVOICE" : "REPAIR SPACE RECEIPT";
  doc.text(title, 547, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(r.reference, 547, 74, { align: "right" });
  doc.text(new Date(r.createdAt).toLocaleDateString("en-PH"), 547, 86, {
    align: "right",
  });

  y = Math.max(y, 100) + 10;
  doc.setDrawColor(30);
  doc.setLineWidth(1);
  doc.line(left, y, 547, y);
  y += 22;

  // Customer
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Reserved for", left, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  const custLines = [
    r.customerName,
    r.contactNumber ? `Tel: ${r.contactNumber}` : "",
    r.contactEmail,
    r.socialMedia ? `Social: ${r.socialMedia}` : "",
  ].filter(Boolean);
  for (const line of custLines) {
    doc.text(line, left, y);
    y += 13;
  }

  // Booking box
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Booking details", left, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  doc.text(`Date:  ${niceDate(r.date)}`, left, y);
  y += 13;
  doc.text(`Time:  ${slotSummary(r)}`, left, y);
  y += 13;
  doc.text(
    `Rate:  ${formatCurrency(r.hourlyRate)} / hour  (space + tools)`,
    left,
    y
  );
  y += 20;

  // Totals table
  doc.setDrawColor(200);
  doc.line(left, y, 547, y);
  y += 16;
  const rightCol = 547;
  const rows: [string, string][] = [
    [
      `${r.hours.length} hr${r.hours.length === 1 ? "" : "s"} × ${formatCurrency(
        r.hourlyRate
      )}`,
      formatCurrency(a.lineSubtotal),
    ],
    [
      r.taxInclusive ? "VATable (net)" : "Subtotal",
      formatCurrency(a.net),
    ],
    [
      `VAT (${r.taxRate}%${r.taxInclusive ? ", incl." : ""})`,
      formatCurrency(a.vat),
    ],
  ];
  doc.setFontSize(10);
  for (const [label, val] of rows) {
    doc.setTextColor(90);
    doc.text(label, left, y);
    doc.setTextColor(20);
    doc.text(val, rightCol, y, { align: "right" });
    y += 15;
  }
  y += 4;
  doc.setDrawColor(30);
  doc.line(left, y, 547, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total Due", left, y);
  doc.text(formatCurrency(a.total), rightCol, y, { align: "right" });

  // Footer
  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (settings.receiptFooter) {
    doc.text(settings.receiptFooter, left, y);
    y += 24;
  }
  if (kind === "invoice") {
    doc.text("Received by: ______________________", left, y + 20);
    doc.text("Authorized: ______________________", 320, y + 20);
  }

  doc.save(`${r.reference}-${kind}.pdf`);
}

// ---- Word (.docx) ---------------------------------------------------------

export async function downloadReservationDocx(
  r: Reservation,
  settings: StoreSettings,
  kind: DocKind
): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
  } = await import("docx");
  const a = amounts(r);

  const title =
    kind === "invoice" ? "REPAIR SPACE INVOICE" : "REPAIR SPACE RECEIPT";

  const headerInfo = [
    settings.tagline,
    [settings.address1, settings.address2].filter(Boolean).join(", "),
    [settings.phone, settings.email].filter(Boolean).join(" · "),
    settings.tin ? `TIN: ${settings.tin}` : "",
  ].filter(Boolean);

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  function totalRow(label: string, value: string, bold = false) {
    return new TableRow({
      children: [
        new TableCell({
          borders: noBorder,
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold })],
            }),
          ],
        }),
        new TableCell({
          borders: noBorder,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: value, bold })],
            }),
          ],
        }),
      ],
    });
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: settings.storeName, bold: true, size: 32 }),
            ],
          }),
          ...headerInfo.map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 18, color: "666666" })],
              })
          ),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 26 })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${r.reference}  ·  ${new Date(
                  r.createdAt
                ).toLocaleDateString("en-PH")}`,
                size: 18,
                color: "666666",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Reserved for", bold: true })],
          }),
          new Paragraph({ text: r.customerName }),
          ...(r.contactNumber
            ? [new Paragraph({ text: `Tel: ${r.contactNumber}` })]
            : []),
          ...(r.contactEmail ? [new Paragraph({ text: r.contactEmail })] : []),
          ...(r.socialMedia
            ? [new Paragraph({ text: `Social: ${r.socialMedia}` })]
            : []),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Booking details", bold: true })],
          }),
          new Paragraph({ text: `Date: ${niceDate(r.date)}` }),
          new Paragraph({ text: `Time: ${slotSummary(r)}` }),
          new Paragraph({
            text: `Rate: ${formatCurrency(r.hourlyRate)} / hour (space + tools)`,
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              insideHorizontal: {
                style: BorderStyle.NONE,
                size: 0,
                color: "FFFFFF",
              },
              insideVertical: {
                style: BorderStyle.NONE,
                size: 0,
                color: "FFFFFF",
              },
            },
            rows: [
              totalRow(
                `${r.hours.length} hr${
                  r.hours.length === 1 ? "" : "s"
                } × ${formatCurrency(r.hourlyRate)}`,
                formatCurrency(a.lineSubtotal)
              ),
              totalRow(
                r.taxInclusive ? "VATable (net)" : "Subtotal",
                formatCurrency(a.net)
              ),
              totalRow(
                `VAT (${r.taxRate}%${r.taxInclusive ? ", incl." : ""})`,
                formatCurrency(a.vat)
              ),
              totalRow("Total Due", formatCurrency(a.total), true),
            ],
          }),
          new Paragraph({ text: "" }),
          ...(settings.receiptFooter
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: settings.receiptFooter,
                      italics: true,
                      color: "666666",
                    }),
                  ],
                }),
              ]
            : []),
          ...(kind === "invoice"
            ? [
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({
                  text: "Received by: ______________________     Authorized: ______________________",
                }),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${r.reference}-${kind}.docx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
