"use client";

import { useState } from "react";
import { CheckCircle2, Printer, Plus, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/use-store";
import { getSettings } from "@/data/store";
import { formatCurrency } from "@/lib/utils";
import type { Sale, StoreSettings } from "@/lib/types";

type DocKind = "receipt" | "invoice";

export function ReceiptView({
  sale,
  onNewSale,
}: {
  sale: Sale;
  onNewSale: () => void;
}) {
  const settings = useStore(() => getSettings());
  const [doc, setDoc] = useState<DocKind>("receipt");

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center p-5 md:p-8">
      {/* Completion header — hidden when printing */}
      <div className="mb-6 flex flex-col items-center text-center print:hidden">
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Sale complete</h1>
        <p className="text-sm text-ink-muted">
          {sale.invoiceNumber} · Inventory updated
        </p>
      </div>

      {/* Document type switch — hidden when printing */}
      <div className="mb-4 flex gap-1 rounded-lg border border-surface-border bg-surface p-1 print:hidden">
        <button
          onClick={() => setDoc("receipt")}
          className={
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors " +
            (doc === "receipt"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted")
          }
        >
          <Receipt className="h-4 w-4" /> Receipt
        </button>
        <button
          onClick={() => setDoc("invoice")}
          className={
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors " +
            (doc === "invoice"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted")
          }
        >
          <FileText className="h-4 w-4" /> Invoice
        </button>
      </div>

      {/* The printable document */}
      <div className="w-full print-area">
        {doc === "receipt" ? (
          <ReceiptDocument sale={sale} settings={settings} />
        ) : (
          <InvoiceDocument sale={sale} settings={settings} />
        )}
      </div>

      {/* Actions — hidden when printing */}
      <div className="mt-6 flex w-full max-w-md gap-3 print:hidden">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => window.print()}
        >
          <Printer className="h-5 w-5" />
          Print {doc === "receipt" ? "receipt" : "invoice"}
        </Button>
        <Button size="lg" className="flex-1" onClick={onNewSale}>
          <Plus className="h-5 w-5" />
          New sale
        </Button>
      </div>

      {/* Print rules: only the .print-area shows, on white. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// --- Compact receipt (thermal style) ---------------------------------------

function ReceiptDocument({
  sale,
  settings,
}: {
  sale: Sale;
  settings: StoreSettings;
}) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-surface-border bg-white p-6 text-ink shadow-card print:border-0 print:shadow-none">
      <div className="text-center">
        <div className="text-lg font-bold">{settings.storeName}</div>
        {settings.tagline && (
          <div className="text-xs text-gray-500">{settings.tagline}</div>
        )}
        <div className="mt-2 space-y-0.5 text-xs text-gray-600">
          {settings.address1 && <div>{settings.address1}</div>}
          {settings.address2 && <div>{settings.address2}</div>}
          {settings.tin && <div>TIN: {settings.tin}</div>}
          {settings.phone && <div>{settings.phone}</div>}
        </div>
      </div>

      <div className="my-4 border-t border-dashed border-gray-300" />

      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{sale.invoiceNumber}</span>
        <span>{new Date(sale.soldAt).toLocaleString()}</span>
      </div>
      <div className="mb-3 text-xs text-gray-600">
        Cashier sale · {sale.customerName}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-1">
                <div>{it.name}</div>
                <div className="text-xs text-gray-500">
                  {it.quantity} × {formatCurrency(it.unitPrice)}
                </div>
              </td>
              <td className="py-1 text-right">{formatCurrency(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-3 border-t border-dashed border-gray-300" />

      <div className="space-y-1 text-sm">
        <Row
          label={sale.taxInclusive ? "VATable (net)" : "Subtotal"}
          value={formatCurrency(sale.net)}
          muted
        />
        <Row
          label={`VAT ${sale.taxRate}%${sale.taxInclusive ? " (incl.)" : ""}`}
          value={formatCurrency(sale.taxTotal)}
          muted
        />
        <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        {sale.payments.map((p, i) => (
          <Row
            key={i}
            label={`Paid — ${p.paymentType}`}
            value={formatCurrency(p.amount)}
            muted
          />
        ))}
      </div>

      {settings.receiptFooter && (
        <p className="mt-5 text-center text-xs italic text-gray-600">
          {settings.receiptFooter}
        </p>
      )}
      <p className="mt-1 text-center text-[10px] text-gray-400">
        This serves as your official receipt.
      </p>
    </div>
  );
}

// --- Full invoice (A4 / Letter) --------------------------------------------

function InvoiceDocument({
  sale,
  settings,
}: {
  sale: Sale;
  settings: StoreSettings;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-surface-border bg-white p-8 text-ink shadow-card print:border-0 print:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-gray-800 pb-4">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {settings.storeName}
          </div>
          {settings.tagline && (
            <div className="text-sm text-gray-500">{settings.tagline}</div>
          )}
          <div className="mt-2 space-y-0.5 text-xs text-gray-600">
            {settings.address1 && <div>{settings.address1}</div>}
            {settings.address2 && <div>{settings.address2}</div>}
            {settings.phone && <div>Tel: {settings.phone}</div>}
            {settings.email && <div>{settings.email}</div>}
            {settings.website && <div>{settings.website}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold uppercase tracking-wide text-gray-900">
            Sales Invoice
          </div>
          <div className="mt-2 text-sm">
            <div className="font-semibold text-gray-900">
              {sale.invoiceNumber}
            </div>
            <div className="text-gray-600">
              {new Date(sale.soldAt).toLocaleDateString()}
            </div>
            <div className="text-gray-600">
              {new Date(sale.soldAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          {settings.tin && (
            <div className="mt-2 text-xs text-gray-700">
              <span className="font-semibold">TIN:</span> {settings.tin}
            </div>
          )}
          {settings.businessReg && (
            <div className="text-xs text-gray-700">
              <span className="font-semibold">Reg:</span> {settings.businessReg}
            </div>
          )}
        </div>
      </div>

      {/* Bill to */}
      <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-gray-500">
            Bill to
          </div>
          <div className="mt-1 font-medium text-gray-900">
            {sale.customerName || "Walk-in customer"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase text-gray-500">
            Payment
          </div>
          <div className="mt-1 text-gray-900">
            {sale.payments.map((p) => p.paymentType).join(", ") || "—"}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-y border-gray-300 text-left text-xs uppercase text-gray-500">
            <th className="py-2">Description</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sale.items.map((it, i) => (
            <tr key={i}>
              <td className="py-2 text-gray-900">{it.name}</td>
              <td className="py-2 text-center text-gray-700">{it.quantity}</td>
              <td className="py-2 text-right text-gray-700">
                {formatCurrency(it.unitPrice)}
              </td>
              <td className="py-2 text-right font-medium text-gray-900">
                {formatCurrency(it.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <Row
            label={sale.taxInclusive ? "VATable sale (net)" : "Subtotal"}
            value={formatCurrency(sale.net)}
          />
          <Row
            label={`VAT (${sale.taxRate}%${sale.taxInclusive ? ", incl." : ""})`}
            value={formatCurrency(sale.taxTotal)}
          />
          <div className="flex justify-between border-t-2 border-gray-800 pt-2 text-lg font-bold text-gray-900">
            <span>Total Due</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-gray-300 pt-4 text-xs text-gray-600">
        {settings.receiptFooter && <p>{settings.receiptFooter}</p>}
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <div className="border-t border-gray-400 pt-1 text-center">
              Received by
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1 text-center">
              Authorized signature
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-gray-400">
          This is a system-generated sales invoice.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={
        "flex justify-between " + (muted ? "text-gray-600" : "text-gray-900")
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
