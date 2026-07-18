import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Philippine Peso currency. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

export const DEFAULT_VAT_RATE = 12; // percent — PH standard VAT

export interface VatBreakdown {
  /** Sum of line items as entered (gross of tenders). */
  lineSubtotal: number;
  /** Net-of-VAT portion. */
  net: number;
  /** VAT amount. */
  vat: number;
  /** Amount the customer pays. */
  grandTotal: number;
  rate: number;
  inclusive: boolean;
}

/**
 * Compute a VAT breakdown for a cart.
 *
 * - Exclusive: prices are net; VAT is added on top.
 *     net = subtotal, vat = subtotal * rate, total = subtotal + vat
 * - Inclusive: prices already contain VAT (standard PH retail); the VAT is
 *   backed out for display but the total equals the subtotal.
 *     total = subtotal, net = subtotal / (1 + rate), vat = subtotal - net
 */
export function computeVat(
  lineSubtotal: number,
  ratePercent: number,
  inclusive: boolean
): VatBreakdown {
  const rate = Math.max(0, ratePercent) / 100;
  if (inclusive) {
    const net = rate > 0 ? lineSubtotal / (1 + rate) : lineSubtotal;
    const vat = lineSubtotal - net;
    return {
      lineSubtotal,
      net,
      vat,
      grandTotal: lineSubtotal,
      rate: ratePercent,
      inclusive,
    };
  }
  const vat = lineSubtotal * rate;
  return {
    lineSubtotal,
    net: lineSubtotal,
    vat,
    grandTotal: lineSubtotal + vat,
    rate: ratePercent,
    inclusive,
  };
}

/** Generate a human-friendly invoice number, e.g. KEI-20260718-0042. */
export function makeInvoiceNumber(seq: number, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `KEI-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}
