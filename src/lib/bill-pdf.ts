import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY_NAME, deliveryLine, balanceOf, itemsOf, type InvoiceSale, type ShopInfo } from "@/components/InvoiceDoc";

const rs = (n: number) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function downloadBillPdf(sale: InvoiceSale, shop: ShopInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const isGst = sale.gst_type === "gst";
  doc.setFont("helvetica", "bold").setFontSize(18).text(COMPANY_NAME, 14, 18);
  doc.setFont("helvetica", "normal").setFontSize(9);
  let y = 23;
  for (const l of [shop.address, shop.city, shop.phone ? `Phone ${shop.phone}` : null, isGst && shop.gstin ? `GSTIN ${shop.gstin}` : null]) {
    if (l) { doc.text(l, 14, y); y += 4; }
  }
  doc.setFont("helvetica", "bold").setFontSize(12).text(isGst ? "TAX INVOICE" : sale.gst_type === "direct" ? "CASH BILL" : "BILL OF SUPPLY", 196, 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (sale.invoice_no) doc.text(`No. ${sale.invoice_no}`, 196, 23, { align: "right" });
  doc.text(`Date ${new Date(sale.created_at).toLocaleDateString("en-GB")}`, 196, 27, { align: "right" });
  y = Math.max(y, 32) + 3;
  doc.setFont("helvetica", "bold").text(`Billed to: ${sale.customer}`, 14, y);
  doc.setFont("helvetica", "normal");
  if (sale.customer_phone) { y += 4; doc.text(`Mobile ${sale.customer_phone}`, 14, y); }
  if (isGst && sale.customer_gstin) { y += 4; doc.text(`GSTIN ${sale.customer_gstin}`, 14, y); }
  if (sale.staff_name) { y += 4; doc.text(`Billed by ${sale.staff_name}`, 14, y); }
  const del = deliveryLine(sale);
  if (del) { y += 4; doc.text(`Delivery ${del}`, 14, y); }

  autoTable(doc, {
    startY: y + 5,
    head: [["#", "Description", "Pieces", "Rate / pc", "Amount"]],
    body: itemsOf(sale).map((l, i) => [i + 1, l.item, l.pieces, l.rate.toFixed(2), rs(l.pieces * l.rate)]),
    headStyles: { fillColor: [20, 20, 20] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 6;
  const row = (a: string, b: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(a, 130, ty); doc.text(b, 196, ty, { align: "right" }); ty += 5;
  };
  if (Number(sale.discount_amount ?? 0) > 0) row("Offer", `- ${rs(Number(sale.discount_amount))}`);
  row("Taxable value", rs(sale.subtotal));
  if (isGst) {
    row(`CGST ${sale.gst_rate / 2}%`, rs(sale.tax_amount / 2));
    row(`SGST ${sale.gst_rate / 2}%`, rs(sale.tax_amount / 2));
  }
  row("TOTAL", rs(sale.total_amount), true);
  row("Paid", rs(Number(sale.paid_amount ?? 0)));
  if (balanceOf(sale) > 0.005) row("Balance due", rs(balanceOf(sale)), true);
  doc.save(`${sale.invoice_no ?? "bill"}.pdf`);
}
