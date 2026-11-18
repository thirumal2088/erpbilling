import {
  COMPANY_NAME,
  UPI_ID,
  balanceOf,
  deliveryLine,
  itemsOf,
  type InvoiceSale,
  type ShopInfo,
} from "@/components/InvoiceDoc";

const inr = (n: number) =>
  "Rs." + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function billShareText(sale: InvoiceSale, shop: ShopInfo) {
  const lines: string[] = [];
  lines.push(`*${COMPANY_NAME}*`);
  if (sale.invoice_no) lines.push(`Bill ${sale.invoice_no}`);
  lines.push(new Date(sale.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
  lines.push(`Customer: ${sale.customer}`);
  const del = deliveryLine(sale);
  if (del) lines.push(`Delivery: ${del}`);
  lines.push("");
  for (const l of itemsOf(sale)) {
    lines.push(`${l.item} — ${l.pieces} pcs x ${l.rate} = ${inr(l.pieces * l.rate)}`);
  }
  if (Number(sale.discount_amount ?? 0) > 0) lines.push(`Offer: -${inr(Number(sale.discount_amount))}`);
  if (sale.gst_type === "gst") lines.push(`GST ${sale.gst_rate}%: ${inr(Number(sale.tax_amount))}`);
  lines.push(`*Total: ${inr(Number(sale.total_amount))}*`);
  const bal = balanceOf(sale);
  if (bal > 0.005) {
    lines.push(`Paid: ${inr(Number(sale.paid_amount ?? 0))} · Balance: ${inr(bal)}`);
    lines.push(`Pay UPI: ${UPI_ID}`);
  } else if (sale.payment_mode !== "credit") {
    lines.push(`Paid by ${sale.payment_mode.toUpperCase()}`);
  } else {
    lines.push(`Paid (credit settled)`);
  }
  if (shop.address) lines.push(``, shop.address);
  return lines.join("\n");
}

export function shareOnWhatsApp(sale: InvoiceSale, shop: ShopInfo) {
  const digits = (sale.customer_phone ?? "").replace(/\D/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  const text = billShareText(sale, shop);
  const url =
    e164.length >= 10
      ? `https://wa.me/${e164}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}
