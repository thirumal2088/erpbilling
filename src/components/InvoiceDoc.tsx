import { QRCodeSVG } from "qrcode.react";
import { money, num } from "@/lib/format";

export type PrintFormat = "a4" | "pos80";

export const PRINT_FORMATS: { id: PrintFormat; label: string; hint: string }[] = [
  { id: "pos80", label: "POS 80mm", hint: "default · thermal roll" },
  { id: "a4", label: "A4 sheet", hint: "optional · 210 × 297 mm" },
];

export type InvoiceSale = {
  id: string;
  invoice_no: string | null;
  created_at: string;
  customer: string;
  customer_gstin: string | null;
  customer_phone?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  staff_name?: string | null;
  design_notes?: string | null;
  item: string;
  pieces: number;
  rate_per_piece: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  gst_type: string;
  gst_rate: number;
  payment_mode: "cash" | "upi" | "credit";
  paid_amount?: number | null;
  offer_type?: string | null;
  offer_value?: number | null;
  discount_amount?: number | null;
  line_items?: unknown;
  design_path?: string | null;
};

export const COMPANY_NAME = "RAINBOW SPORTS";

export type LineItem = { item: string; pieces: number; rate: number };

export function itemsOf(s: InvoiceSale): LineItem[] {
  const li = Array.isArray(s.line_items) ? (s.line_items as LineItem[]) : [];
  if (li.length) return li.map((l) => ({ item: String(l.item), pieces: Number(l.pieces), rate: Number(l.rate) }));
  return [{ item: s.item, pieces: Number(s.pieces), rate: Number(s.rate_per_piece) }];
}

export function grossOf(s: InvoiceSale) {
  return Number(s.subtotal) + Number(s.discount_amount ?? 0);
}

export function offerLabel(s: InvoiceSale) {
  return s.offer_type === "percent" ? `Offer ${Number(s.offer_value)}%` : "Offer";
}

export const UPI_ID = "BHARATPE2C0Y0N0U1U34312@unitype";

export function balanceOf(s: InvoiceSale) {
  return Math.max(0, Number(s.total_amount) - Number(s.paid_amount ?? 0));
}

export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Paid · Cash",
  upi: "Paid · UPI",
  credit: "Credit · Unpaid",
};

export const DELIVERY_LABEL: Record<string, string> = {
  pickup: "Store pickup",
  delivery: "Home delivery",
  courier: "Courier",
};

export function deliveryLine(s: InvoiceSale): string | null {
  const mode = s.delivery_option && s.delivery_option !== "pickup"
    ? DELIVERY_LABEL[s.delivery_option] ?? s.delivery_option
    : null;
  const date = s.delivery_date ? dateLabel(s.delivery_date) : null;
  if (!mode && !date) return null;
  const parts = mode ? [mode] : [];
  if (date) parts.push(date);
  return parts.join(" · ");
}

function payLabel(s: InvoiceSale) {
  const bal = balanceOf(s);
  if (bal <= 0.005) return s.payment_mode === "credit" ? "Paid" : PAYMENT_LABEL[s.payment_mode];
  if (Number(s.paid_amount ?? 0) > 0) return `Partial · Paid ${money(Number(s.paid_amount))}`;
  return PAYMENT_LABEL["credit"];
}

function PayQR({ sale, shop, size }: { sale: InvoiceSale; shop: ShopInfo; size: number }) {
  const bal = balanceOf(sale);
  if (bal <= 0.005) return null;
  const url = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(COMPANY_NAME)}&am=${bal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(sale.invoice_no ?? "Bill")}`;
  return (
    <div className="mt-2 flex flex-col items-center text-center">
      <QRCodeSVG value={url} size={size} />
      <div className="mt-1 font-bold">Scan to pay {money(bal)}</div>
      <div className="break-all text-[8px]">{UPI_ID}</div>
    </div>
  );
}

export type ShopInfo = {
  unit_name?: string | null;
  city?: string | null;
  address?: string | null;
  gstin?: string | null;
  phone?: string | null;
};

function dateLabel(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
}

export function PrintStyles({ format }: { format: PrintFormat }) {
  const page =
    format === "a4" ? "size: A4 portrait; margin: 12mm;" : "size: 80mm auto; margin: 3mm;";

  return (
    <style media="print">{`
      @page { ${page} }
      html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
      body *:not(#invoice-print):not(#invoice-print *):not(:has(#invoice-print)) { display: none !important; }
      body *:has(#invoice-print) {
        display: block !important; position: static !important; margin: 0 !important; padding: 0 !important;
        border: 0 !important; box-shadow: none !important; height: auto !important; min-height: 0 !important;
        max-height: none !important; overflow: visible !important; transform: none !important; background: #fff !important;
      }
      #invoice-print {
        position: static !important; width: 100%; max-width: 100% !important; margin: 0 !important;
        background: #fff; color: #000; box-shadow: none !important;
        page-break-after: avoid; break-after: avoid;
      }
    `}</style>
  );
}

export function InvoiceDoc({
  sale,
  shop,
  format,
}: {
  sale: InvoiceSale;
  shop: ShopInfo;
  format: PrintFormat;
}) {
  const isGst = sale.gst_type === "gst";
  const half = Number(sale.tax_amount) / 2;
  const pos = format !== "a4";

  if (pos) {
    return (
      <div
        className={`mx-auto bg-paper p-3 font-mono text-ink ${
          "max-w-[80mm] text-[10px]"
        }`}
      >
        <div className="text-center">
          <div className="font-display text-[14px] uppercase tracking-wide">
            {COMPANY_NAME}
          </div>
          {shop.address ? <div>{shop.address}</div> : null}
          {shop.city ? <div>{shop.city}</div> : null}
          {shop.phone ? <div>Ph {shop.phone}</div> : null}
          {isGst && shop.gstin ? <div>GSTIN {shop.gstin}</div> : null}
          <div className="mt-1 border-t border-dashed border-ink/50 pt-1 uppercase">
            {isGst ? "Tax Invoice" : sale.gst_type === "direct" ? "Cash Bill" : "Bill of Supply"}
          </div>
        </div>

        <div className="mt-1 border-t border-dashed border-ink/50 pt-1">
          {sale.invoice_no ? <div>No: {sale.invoice_no}</div> : null}
          <div>Date: {dateLabel(sale.created_at)}</div>
          <div className="truncate">To: {sale.customer}</div>
          {sale.customer_phone ? <div>Mob: {sale.customer_phone}</div> : null}
          {deliveryLine(sale) ? <div>Del: {deliveryLine(sale)}</div> : null}
        </div>

        <div className="mt-1 border-t border-dashed border-ink/50 pt-1">
          {itemsOf(sale).map((l, i) => (
            <div key={i}>
              <div className="truncate uppercase">{l.item}</div>
              <div className="flex justify-between">
                <span>
                  {num(l.pieces)} pcs × {num(l.rate)}
                </span>
                <span>{money(l.pieces * l.rate)}</span>
              </div>
            </div>
          ))}
          {Number(sale.discount_amount ?? 0) > 0 ? (
            <div className="flex justify-between">
              <span>{offerLabel(sale)}</span>
              <span>- {money(Number(sale.discount_amount))}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-1 border-t border-dashed border-ink/50 pt-1">
          {isGst ? (
            <>
              <div className="flex justify-between">
                <span>CGST {sale.gst_rate / 2}%</span>
                <span>{money(half)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST {sale.gst_rate / 2}%</span>
                <span>{money(half)}</span>
              </div>
            </>
          ) : (
            <div>No GST charged</div>
          )}
          <div className="mt-1 flex justify-between border-t border-ink/60 pt-1 text-[12px] font-bold">
            <span>TOTAL</span>
            <span>{money(sale.total_amount)}</span>
          </div>
        </div>

        <div className="mt-1 border-t border-dashed border-ink/50 pt-1 text-center font-bold uppercase">
          {payLabel(sale)}
          {balanceOf(sale) > 0.005 ? <div>Balance {money(balanceOf(sale))}</div> : null}
        </div>

        <PayQR sale={sale} shop={shop} size={140} />

        <div className="mt-2 text-center">*** Thank you ***</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-paper p-6 text-ink">
      <div className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
        <div>
          <div className="font-display text-2xl uppercase tracking-wide">
            {COMPANY_NAME}
          </div>
          <div className="mt-1 font-mono text-[11px] leading-relaxed">
            {shop.address ? <div>{shop.address}</div> : null}
            {shop.city ? <div>{shop.city}</div> : null}
            {shop.phone ? <div>Phone {shop.phone}</div> : null}
            {isGst && shop.gstin ? <div>GSTIN {shop.gstin}</div> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg uppercase tracking-widest">
            {isGst ? "Tax Invoice" : sale.gst_type === "direct" ? "Cash Bill" : "Bill of Supply"}
          </div>
          <div className="mt-1 font-mono text-[11px]">
            <div>GST NO: 33ALEPT8682N1Z9</div>
            {sale.invoice_no ? <div>No. {sale.invoice_no}</div> : null}
            <div>Date {dateLabel(sale.created_at)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 font-mono text-[11px] uppercase tracking-widest text-quiet">Billed to</div>
      <div className="text-[15px] font-semibold">{sale.customer}</div>
      {sale.customer_phone ? <div className="font-mono text-[11px]">Mobile {sale.customer_phone}</div> : null}
      {deliveryLine(sale) ? <div className="font-mono text-[11px]">Delivery {deliveryLine(sale)}</div> : null}
      {sale.staff_name ? <div className="font-mono text-[11px]">Billed by {sale.staff_name}</div> : null}
      {sale.design_notes ? <div className="whitespace-pre-wrap font-mono text-[11px]">Notes: {sale.design_notes}</div> : null}
      {isGst && sale.customer_gstin ? (
        <div className="font-mono text-[11px]">GSTIN {sale.customer_gstin}</div>
      ) : null}

      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-ink text-paper">
            <th className="px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-widest">
              Description
            </th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-widest">
              Pieces
            </th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-widest">
              Rate / pc
            </th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-widest">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {itemsOf(sale).map((l, i) => (
            <tr key={i} className="border-b border-line">
              <td className="px-2 py-2">{l.item}</td>
              <td className="px-2 py-2 text-right font-mono">{num(l.pieces)}</td>
              <td className="px-2 py-2 text-right font-mono">{num(l.rate)}</td>
              <td className="px-2 py-2 text-right font-mono">{money(l.pieces * l.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-full max-w-[72mm] font-mono text-[12px]">
        {Number(sale.discount_amount ?? 0) > 0 ? (
          <div className="flex justify-between py-0.5">
            <span>{offerLabel(sale)}</span>
            <span>- {money(Number(sale.discount_amount))}</span>
          </div>
        ) : null}
        <div className="flex justify-between py-0.5">
          <span>Taxable value</span>
          <span>{money(sale.subtotal)}</span>
        </div>
        {isGst ? (
          <>
            <div className="flex justify-between py-0.5">
              <span>CGST {sale.gst_rate / 2}%</span>
              <span>{money(half)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>SGST {sale.gst_rate / 2}%</span>
              <span>{money(half)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between py-0.5">
            <span>GST</span>
            <span>Not applicable</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t-2 border-ink pt-1 font-display text-lg">
          <span>TOTAL</span>
          <span>{money(sale.total_amount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-1 text-[11px] font-bold uppercase tracking-widest">
          <span>Payment</span>
          <span>{payLabel(sale)}</span>
        </div>
        {balanceOf(sale) > 0.005 ? (
          <div className="flex justify-between text-[12px] font-bold">
            <span>Balance due</span>
            <span>{money(balanceOf(sale))}</span>
          </div>
        ) : null}
        <div className="text-[10px]">
          <PayQR sale={sale} shop={shop} size={120} />
        </div>
      </div>

      <div className="mt-10 flex items-end justify-between font-mono text-[10px] uppercase tracking-widest text-quiet">
        <span>Goods once sold are not taken back</span>
        <span>Authorised signatory</span>
      </div>
    </div>
  );
}
