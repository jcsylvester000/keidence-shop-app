"use client";

// Client-side invoice/receipt generation for pre-orders (batch sales).
// PDF via jsPDF, Word (.docx) via docx. Both dynamically imported.

import type { PreOrder, StoreSettings } from "@/lib/types";
import { computeVat, formatCurrency } from "@/lib/utils";

type DocKind = "invoice" | "receipt";

function lineSubtotal(o: PreOrder): number {
  return o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
}

function amounts(o: PreOrder) {
  const sub = lineSubtotal(o);
  const v = computeVat(sub, o.taxRate, o.taxInclusive);
  return { net: v.net, vat: v.vat, total: v.grandTotal, sub };
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

export async function downloadPreOrderPdf(
  o: PreOrder,
  settings: StoreSettings,
  kind: DocKind
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const a = amounts(o);
  const left = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(settings.storeName, left, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  for (const line of [
    settings.tagline,
    [settings.address1, settings.address2].filter(Boolean).join(", "),
    [settings.phone, settings.email].filter(Boolean).join(" · "),
    settings.tin ? `TIN: ${settings.tin}` : "",
  ].filter(Boolean)) {
    doc.text(line, left, y);
    y += 12;
  }

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(
    kind === "invoice" ? "PRE-ORDER INVOICE" : "PRE-ORDER RECEIPT",
    547,
    56,
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(o.reference, 547, 74, { align: "right" });
  doc.text(`Pickup: ${niceDate(o.expectedDate)}`, 547, 86, { align: "right" });

  y = Math.max(y, 100) + 10;
  doc.setDrawColor(30);
  doc.setLineWidth(1);
  doc.line(left, y, 547, y);
  y += 22;

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Client", left, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  for (const line of [
    o.clientName,
    o.contactNumber ? `Tel: ${o.contactNumber}` : "",
    o.contactEmail,
    o.socialMedia ? `Social: ${o.socialMedia}` : "",
  ].filter(Boolean)) {
    doc.text(line, left, y);
    y += 13;
  }
  y += 8;

  // Items table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("ITEM", left, y);
  doc.text("QTY", 360, y, { align: "right" });
  doc.text("PRICE", 450, y, { align: "right" });
  doc.text("AMOUNT", 547, y, { align: "right" });
  y += 6;
  doc.setDrawColor(200);
  doc.line(left, y, 547, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  for (const l of o.lines) {
    doc.text(l.name.slice(0, 48), left, y);
    doc.text(String(l.quantity), 360, y, { align: "right" });
    doc.text(formatCurrency(l.unitPrice), 450, y, { align: "right" });
    doc.text(formatCurrency(l.unitPrice * l.quantity), 547, y, {
      align: "right",
    });
    y += 15;
  }

  y += 4;
  doc.setDrawColor(200);
  doc.line(320, y, 547, y);
  y += 16;
  const totals: [string, string][] = [
    [o.taxInclusive ? "VATable (net)" : "Subtotal", formatCurrency(a.net)],
    [`VAT (${o.taxRate}%${o.taxInclusive ? ", incl." : ""})`, formatCurrency(a.vat)],
  ];
  for (const [label, val] of totals) {
    doc.setTextColor(90);
    doc.text(label, 320, y);
    doc.setTextColor(20);
    doc.text(val, 547, y, { align: "right" });
    y += 15;
  }
  y += 2;
  doc.setDrawColor(30);
  doc.line(320, y, 547, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", 320, y);
  doc.text(formatCurrency(a.total), 547, y, { align: "right" });

  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (settings.receiptFooter) {
    doc.text(settings.receiptFooter, left, y);
    y += 20;
  }
  if (kind === "invoice") {
    doc.text("Received by: ______________________", left, y + 20);
    doc.text("Authorized: ______________________", 320, y + 20);
  }

  doc.save(`${o.reference}-${kind}.pdf`);
}

// ---- Word -----------------------------------------------------------------

export async function downloadPreOrderDocx(
  o: PreOrder,
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
  const a = amounts(o);

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
  const tableBorders = {
    ...noBorder,
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  function cell(text: string, opts: { bold?: boolean; align?: "right" } = {}) {
    return new TableCell({
      borders: noBorder,
      children: [
        new Paragraph({
          alignment: opts.align === "right" ? AlignmentType.RIGHT : undefined,
          children: [new TextRun({ text, bold: opts.bold })],
        }),
      ],
    });
  }

  const itemRows = [
    new TableRow({
      children: [
        cell("Item", { bold: true }),
        cell("Qty", { bold: true, align: "right" }),
        cell("Price", { bold: true, align: "right" }),
        cell("Amount", { bold: true, align: "right" }),
      ],
    }),
    ...o.lines.map(
      (l) =>
        new TableRow({
          children: [
            cell(l.name),
            cell(String(l.quantity), { align: "right" }),
            cell(formatCurrency(l.unitPrice), { align: "right" }),
            cell(formatCurrency(l.unitPrice * l.quantity), { align: "right" }),
          ],
        })
    ),
  ];

  function totalRow(label: string, value: string, bold = false) {
    return new TableRow({
      children: [
        new TableCell({
          borders: noBorder,
          children: [new Paragraph({ children: [new TextRun({ text: label, bold })] })],
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
            children: [new TextRun({ text: settings.storeName, bold: true, size: 32 })],
          }),
          ...[
            settings.tagline,
            [settings.address1, settings.address2].filter(Boolean).join(", "),
            [settings.phone, settings.email].filter(Boolean).join(" · "),
            settings.tin ? `TIN: ${settings.tin}` : "",
          ]
            .filter(Boolean)
            .map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 18, color: "666666" })],
                })
            ),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: kind === "invoice" ? "PRE-ORDER INVOICE" : "PRE-ORDER RECEIPT",
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${o.reference}  ·  Pickup: ${niceDate(o.expectedDate)}`,
                size: 18,
                color: "666666",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "Client", bold: true })] }),
          new Paragraph({ text: o.clientName }),
          ...(o.contactNumber ? [new Paragraph({ text: `Tel: ${o.contactNumber}` })] : []),
          ...(o.contactEmail ? [new Paragraph({ text: o.contactEmail })] : []),
          ...(o.socialMedia ? [new Paragraph({ text: `Social: ${o.socialMedia}` })] : []),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: itemRows,
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 50, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.RIGHT,
            borders: noBorder,
            rows: [
              totalRow(o.taxInclusive ? "VATable (net)" : "Subtotal", formatCurrency(a.net)),
              totalRow(`VAT (${o.taxRate}%${o.taxInclusive ? ", incl." : ""})`, formatCurrency(a.vat)),
              totalRow("Total", formatCurrency(a.total), true),
            ],
          }),
          new Paragraph({ text: "" }),
          ...(settings.receiptFooter
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: settings.receiptFooter, italics: true, color: "666666" }),
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${o.reference}-${kind}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
