import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, FieldBox, Panel, inputClass } from "@/components/AppShell";
import {
  InvoiceDoc,
  DELIVERY_LABEL,
  balanceOf,
  PRINT_FORMATS,
  PrintStyles,
  itemsOf,
  type InvoiceSale,
  type PrintFormat,
} from "@/components/InvoiceDoc";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Printer, ChevronDown } from "lucide-react";
import { money, num, STAGES, STAGE_LABEL } from "@/lib/format";
import { shareOnWhatsApp } from "@/lib/whatsapp-share";
import { VoiceRecorder, openBillFile, readExcelFirstRow, uploadBillFile } from "@/components/BillExtras";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { pricesFromFinalAmount } from "@/lib/final-amount";

type Row = { item: string; pieces: string; rate: string };
const emptyRow = (): Row => ({ item: "", pieces: "", rate: "" });

export const Route = createFileRoute("/_authenticated/sales")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } => {
    const e = search["edit"];
    return typeof e === "string" && e ? { edit: e } : {};
  },
  head: () => ({
    meta: [
      { title: "Billing & invoices — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Raise GST and non-GST garment invoices by piece, then print the final bill on an 80mm POS receipt printer or A4.",
      },
      { property: "og:title", content: "Billing & invoices — RAINBOW ERP" },
      {
        property: "og:description",
        content: "GST or plain bills by piece, printed on A4 or POS receipt rolls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

type Tab = "invoice" | "final";

type PanelJob = {
  id: string;
  job_no: string;
  stage: string;
  worker_id: string | null;
  workers: { name: string } | null;
};

const nextStageOf = (stage: string): string => {
  const i = (STAGES as readonly string[]).indexOf(stage);
  if (i === -1 || i >= STAGES.length - 1) return "done";
  return STAGES[i + 1] ?? "done";
};

function SalesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("invoice");

  const [customer, setCustomer] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const [gstType, setGstType] = useState<"gst" | "non_gst" | "direct">("gst");
  const [gstRate, setGstRate] = useState<5 | 12>(5);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "partial" | "credit">("cash");
  const [partialAmt, setPartialAmt] = useState("");
  const [receiveAmt, setReceiveAmt] = useState("");
  const [offerType, setOfferType] = useState<"none" | "percent" | "flat">("none");
  const [offerValue, setOfferValue] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [staffName, setStaffName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryOption, setDeliveryOption] = useState<"pickup" | "delivery" | "courier">("pickup");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [voice, setVoice] = useState<Blob | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [justRaisedId, setJustRaisedId] = useState<string | null>(null);
  const [billSearch, setBillSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [billFilter, setBillFilter] = useState<"pending" | "paid" | "all">("pending");
  const [format, setFormat] = useState<PrintFormat>("pos80");
  const [stageWorker, setStageWorker] = useState("");

  const { data: shop } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("unit_name, city, address, gstin, phone")
        .eq("id", auth.user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as InvoiceSale[];
    },
  });

  // Bills can be opened for editing straight from the Reports page via /sales?edit=<id>.
  const editParam = Route.useSearch().edit;
  useEffect(() => {
    if (!editParam || sales.length === 0) return;
    const s = sales.find((x) => x.id === editParam);
    if (s) {
      startEdit(s);
      navigate({ to: "/sales", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, sales]);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedJobs = [] } = useQuery({
    queryKey: ["work_jobs", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_jobs")
        .select("id, job_no, item, pieces, stage, worker_id, workers(name)")
        .eq("sale_id", selectedId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PanelJob[];
    },
  });

  const selJob = selectedJobs[0] ?? null;

  const validRows = rows.filter((r) => r.item.trim() && Number(r.pieces) > 0);
  let pricedRows = validRows;
  let finalAmountError = "";
  if (finalAmount.trim()) {
    try {
      const rates = pricesFromFinalAmount({
        finalAmount: Number(finalAmount),
        gstRate: gstType === "gst" ? gstRate : 0,
        offerType,
        offerValue: offerType === "none" ? 0 : Number(offerValue || 0),
        items: validRows.map((r) => ({ pieces: Number(r.pieces), rate: Number(r.rate || 0) })),
      });
      pricedRows = validRows.map((r, i) => ({ ...r, rate: String(rates[i] ?? 0) }));
    } catch {
      finalAmountError = "Enter a positive final amount, whole pieces and valid prices; offers must be below 100%.";
    }
  }
  const gross = pricedRows.reduce((a, r) => a + Math.round(Number(r.pieces)) * (Number(r.rate) || 0), 0);
  const ov = Number(offerValue) || 0;
  const discount =
    offerType === "percent"
      ? Math.round(gross * Math.min(ov, 100)) / 100
      : offerType === "flat"
        ? Math.min(ov, gross)
        : 0;
  const subtotal = gross - discount;
  const tax = gstType === "gst" ? Math.round(subtotal * gstRate) / 100 : 0;
  const total = subtotal + tax;

  // Final billing: pending (unpaid/partial + just raised), paid, or all bills.
  const q = billSearch.trim().toLowerCase();
  const pending = sales.filter(
    (s) =>
      (billFilter === "all"
        ? true
        : billFilter === "paid"
          ? balanceOf(s) <= 0.005
          : balanceOf(s) > 0.005 || s.id === justRaisedId) &&
      (q === "" ||
        (s.invoice_no ?? "").toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        (s.customer_phone ?? "").includes(q) ||
        s.item.toLowerCase().includes(q)),
  );
  const selected = pending.find((s) => s.id === selectedId) ?? null;

  const raise = useMutation({
    mutationFn: async () => {
      if (finalAmountError) throw new Error(finalAmountError);
      const paid =
        paymentMode === "cash" || paymentMode === "upi"
          ? Math.round(total * 100) / 100
          : paymentMode === "partial"
            ? Math.min(Number(partialAmt) || 0, total)
            : 0;
      const voice_note_path = voice ? await uploadBillFile(voice, "voice-note.webm") : undefined;
      const attachment_path = excelFile ? await uploadBillFile(excelFile, excelFile.name) : undefined;
      const design_path = designFile ? await uploadBillFile(designFile, designFile.name) : undefined;
      const line_items = pricedRows.map((r) => ({
        item: r.item.trim(),
        pieces: Math.round(Number(r.pieces)),
        rate: Number(r.rate) || 0,
      }));
      const first = line_items[0];
       if (!first) throw new Error("Add at least one item");
      const payload = {
          ...(design_path ? { design_path } : {}),
          ...(voice_note_path ? { voice_note_path } : {}),
          ...(attachment_path ? { attachment_path } : {}),
          line_items,
          staff_name: staffName.trim() || null,
          customer_phone: phone.trim() || null,
          design_notes: designNotes.trim() || null,
          customer: customer.trim(),
          customer_gstin: customerGstin.trim() || null,
          delivery_option: deliveryOption,
          delivery_date: deliveryDate || null,
          item: first.item,
          pieces: first.pieces,
          rate_per_piece: first.rate,
          gst_type: gstType,
          gst_rate: gstType === "gst" ? gstRate : 0,
          payment_mode: paymentMode === "partial" ? "credit" : paymentMode,
          paid_amount: paid,
          offer_type: offerType,
          offer_value: offerType === "none" ? 0 : ov,
      };
      const q = editingId
        ? supabase.from("sales").update(payload).eq("id", editingId)
        : supabase.from("sales").insert(payload);
      const { data, error } = await q.select("id, invoice_no").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      toast.success(row.invoice_no ? `Invoice ${row.invoice_no} ${editingId ? "updated" : "raised"}` : `Direct bill ${editingId ? "updated" : "saved"}`);
      setRows([emptyRow()]);
      setFinalAmount("");
      setEditingId(null);
      setDesignFile(null);
      setCustomer("");
      setPhone("");
      setCustomerGstin("");
      setDeliveryOption("pickup");
      setDeliveryDate("");
      setPartialAmt("");
      setOfferType("none");
      setOfferValue("");
      setDesignNotes("");
      setVoice(null);
      setExcelFile(null);
      setJustRaisedId(row.id);
      setSelectedId(row.id);
      setTab("final");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: async ({ sale, mode }: { sale: InvoiceSale; mode: "cash" | "upi" }) => {
      const bal = balanceOf(sale);
      const amt = receiveAmt.trim() ? Math.min(Number(receiveAmt) || 0, bal) : bal;
      if (amt <= 0) throw new Error("Enter an amount");
      const newPaid = Number(sale.paid_amount ?? 0) + amt;
      const full = newPaid >= Number(sale.total_amount) - 0.005;
      const { error } = await supabase
        .from("sales")
        .update({ paid_amount: newPaid, payment_mode: full ? mode : "credit" })
        .eq("id", sale.id);
      if (error) throw error;
      return full;
    },
    onSuccess: (full) => {
      toast.success(full ? "Fully paid" : "Part payment recorded");
      setReceiveAmt("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startJob = useMutation({
    mutationFn: async (sale: InvoiceSale) => {
      const { error } = await supabase.from("work_jobs").insert({
        job_no: sale.invoice_no ?? `DIRECT-${sale.id.slice(0, 8).toUpperCase()}`,
        sale_id: sale.id,
        item: sale.item,
        pieces: Number(sale.pieces),
        worker_id: stageWorker || null,
        stage: "cutting",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job started at cutting");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advanceJob = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("work_jobs")
        .update({
          stage,
          worker_id: stage === "done" ? null : stageWorker || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stage updated");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onExcel = async (f: File | undefined) => {
    if (!f) return;
    setExcelFile(f);
    try {
      const r = await readExcelFirstRow(f);
      if (r.customer) setCustomer(r.customer);
      if (r.phone) setPhone(r.phone);
      if (r.item || r.pieces || r.rate != null)
        setRows([
          {
            item: r.item ?? "",
            pieces: r.pieces ? String(r.pieces) : "",
            rate: r.rate != null && !Number.isNaN(r.rate) ? String(r.rate) : "",
          },
        ]);
      if (r.details) setDesignNotes(r.details);
      toast.success("Excel loaded into the bill");
    } catch {
      toast.error("Couldn't read that file — it's still attached to the bill");
    }
  };

  const canRaise =
    staffName.trim() &&
    customer.trim() &&
    validRows.length > 0 &&
    !finalAmountError &&
    (paymentMode !== "partial" || (Number(partialAmt) > 0 && Number(partialAmt) < total));

  const startEdit = (s: InvoiceSale) => {
    setFinalAmount("");
    setEditingId(s.id);
    setCustomer(s.customer);
    setPhone(s.customer_phone ?? "");
    setCustomerGstin(s.customer_gstin ?? "");
    setStaffName(s.staff_name ?? "");
    setDeliveryOption((s.delivery_option as "pickup" | "delivery" | "courier") ?? "pickup");
    setDeliveryDate(s.delivery_date ? String(s.delivery_date).slice(0, 10) : "");
    setDesignNotes(s.design_notes ?? "");
    setRows(itemsOf(s).map((l) => ({ item: l.item, pieces: String(l.pieces), rate: String(l.rate) })));
    if (s.gst_type === "gst") {
      setGstType("gst");
      setGstRate(Number(s.gst_rate) === 12 ? 12 : 5);
    } else setGstType(s.gst_type === "direct" ? "direct" : "non_gst");
    setOfferType((s.offer_type as "none" | "percent" | "flat") ?? "none");
    setOfferValue(s.offer_type && s.offer_type !== "none" ? String(s.offer_value ?? "") : "");
    const paid = Number(s.paid_amount ?? 0);
    if (balanceOf(s) <= 0.005 && s.payment_mode !== "credit") setPaymentMode(s.payment_mode);
    else if (paid > 0) {
      setPaymentMode("partial");
      setPartialAmt(String(paid));
    } else setPaymentMode("credit");
    setTab("invoice");
  };

  return (
    <AppShell>
      <PrintStyles format={format} />

      <div className="rise flex flex-wrap gap-1.5">
        <TabButton
          active={tab === "invoice"}
          tone="cobalt"
          label="Invoice"
          hint="raise new"
          onClick={() => setTab("invoice")}
        />
        <TabButton
          active={tab === "final"}
          tone="leaf"
          label="Final billing"
          hint={`${pending.length} pending`}
          onClick={() => setTab("final")}
        />
      </div>

      {tab === "invoice" ? (
        <Panel title={editingId ? "Edit invoice" : "New invoice"} hint={editingId ? "updating bill" : "auto numbered"} hintTone="cobalt">
          <div className="mt-2 rounded-xl bg-ink px-3 py-2 text-center font-display text-sm uppercase tracking-normal text-paper">
            RAINBOW SPORTS
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">Bill type</div>
              <select
                value={gstType === "gst" ? `gst-${gstRate}` : gstType}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "direct") setGstType("direct");
                  else if (v === "non_gst") setGstType("non_gst");
                  else {
                    setGstType("gst");
                    setGstRate(Number(v.replace("gst-", "")) as 5 | 12);
                  }
                }}
                className="mt-1 inline-block cursor-pointer appearance-none rounded-lg bg-marigold/20 pl-2.5 pr-7 py-2 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border transition-colors hover:bg-marigold/30"
              >
                <option value="direct">Direct bill</option>
                <option value="non_gst">No GST</option>
                <option value="gst-5">GST 5%</option>
                <option value="gst-12">GST 12%</option>
              </select>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">Payment</div>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as "cash" | "upi" | "partial" | "credit")}
                className="mt-1 inline-block cursor-pointer appearance-none rounded-lg bg-cobalt/15 pl-2.5 pr-7 py-2 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border transition-colors hover:bg-cobalt/25"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="partial">Partial</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">Delivery</div>
              <select
                value={deliveryOption}
                onChange={(e) => setDeliveryOption(e.target.value as "pickup" | "delivery" | "courier")}
                className="mt-1 inline-block cursor-pointer appearance-none rounded-lg bg-plum/15 pl-2.5 pr-7 py-2 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border transition-colors hover:bg-plum/25"
              >
                <option value="pickup">Store pickup</option>
                <option value="delivery">Home delivery</option>
                <option value="courier">Courier</option>
              </select>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">Delivery date</div>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1 inline-block cursor-pointer rounded-lg bg-background px-2.5 py-2 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border"
              />
            </div>
          </div>
          <div className="mt-2 max-w-xs">
            <FieldBox label="Final amount (including GST)">
              <input
                className={`${inputClass} rounded-lg bg-leaf/10 ring-1 ring-leaf/30`}
                aria-label="Final amount (including GST)"
                aria-invalid={Boolean(finalAmountError)}
                aria-describedby={finalAmountError ? "final-amount-error" : undefined}
                type="number"
                inputMode="decimal"
                min="0.01"
                max="1000000000"
                step="0.01"
                value={finalAmount}
                onChange={(e) => setFinalAmount(e.target.value)}
                placeholder="Optional"
              />
            </FieldBox>
            {finalAmountError ? <p id="final-amount-error" role="alert" className="mt-1 text-xs text-tomato">{finalAmountError}</p> : null}
          </div>
          {paymentMode === "partial" ? (
            <div className="mt-2">
              <FieldBox label={`Paid now (of ${money(total)})`}>
                <input
                  className={inputClass}
                  type="number"
                  inputMode="decimal"
                  value={partialAmt}
                  onChange={(e) => setPartialAmt(e.target.value)}
                  placeholder="500"
                />
              </FieldBox>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <FieldBox label="Staff name" className="col-span-2">
              <input
                className={inputClass}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Who is billing"
              />
            </FieldBox>
            <FieldBox label="Customer name">
              <input
                className={inputClass}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Kiran Fabrics"
              />
            </FieldBox>
            <FieldBox label="Mobile number">
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
              />
            </FieldBox>
            {gstType === "gst" ? (
              <FieldBox label="Customer GSTIN (optional)" className="col-span-2">
                <input
                  className={inputClass}
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  placeholder="33ABCDE1234F1Z5"
                />
              </FieldBox>
            ) : null}
          </div>

          <div className="mt-3 space-y-2 rounded-xl bg-marigold/15 p-2.5 ring-1 ring-marigold/30">
            <div className="font-mono text-[11px] uppercase tracking-normal text-ink">Items</div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_70px_auto] items-end gap-1.5">
                <FieldBox label={`Item ${i + 1}`}>
                  <input className={inputClass} value={r.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="Jersey" />
                </FieldBox>
                <FieldBox label="Pcs">
                  <input className={inputClass} inputMode="numeric" value={r.pieces} onChange={(e) => setRow(i, { pieces: e.target.value })} placeholder="10" />
                </FieldBox>
                <FieldBox label="Rate">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    readOnly={Boolean(finalAmount.trim()) && !finalAmountError}
                    value={finalAmount.trim() && !finalAmountError ? String(Number(Number(pricedRows.find((_, j) => validRows[j] === r)?.rate ?? 0).toFixed(4))) : r.rate}
                    onChange={(e) => setRow(i, { rate: e.target.value })}
                    placeholder="385"
                  />
                </FieldBox>
                <Button variant="unstyled" size="unstyled"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="mb-1 rounded-lg bg-tomato/15 px-2 py-2 font-mono text-xs text-tomato disabled:opacity-30"
                  aria-label="Remove item"
                >
                  ✕
                </Button>
              </div>
            ))}
            <div className="flex justify-end">
              <Button variant="unstyled" size="unstyled"
                onClick={() => setRows((rs) => [...rs, emptyRow()])}
                className="w-fit rounded-lg bg-marigold px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-ink transition-transform active:scale-95"
              >
                + Add item
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-2 rounded-xl bg-cobalt/10 p-2.5 ring-1 ring-cobalt/20">
            <div className="font-mono text-[11px] uppercase tracking-normal text-cobalt">Design & details</div>
            <textarea
              className={`${inputClass} min-h-20 w-full rounded-lg bg-background p-2`}
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              placeholder="Design, sizes, colours, print, packing notes…"
            />
            <VoiceRecorder value={voice} onChange={setVoice} />
            <div className="flex flex-wrap gap-1.5">
              <label className="flex w-fit max-w-full cursor-pointer items-center gap-1.5 break-all rounded-lg bg-leaf px-2.5 py-1.5 font-mono text-xs uppercase tracking-normal text-paper transition-colors hover:brightness-110">
                ⬆ {excelFile ? excelFile.name : "Upload Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => onExcel(e.target.files?.[0])}
                />
              </label>
              <label className="flex w-fit max-w-full cursor-pointer items-center gap-1.5 break-all rounded-lg bg-plum px-2.5 py-1.5 font-mono text-xs uppercase tracking-normal text-paper transition-colors hover:brightness-110">
                🎨 {designFile ? designFile.name : "Upload design"}
                <input
                  type="file"
                  accept="image/*,.pdf,.cdr,.ai,.psd"
                  className="hidden"
                  onChange={(e) => setDesignFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <p className="font-mono text-[11px] text-quiet">
              Excel columns like Customer, Phone, Item, Pieces, Rate, Details fill the bill automatically.
            </p>
          </div>

          <div className="mt-3 rounded-xl bg-plum/10 p-2.5 ring-1 ring-plum/20">
            <div className="font-mono text-[11px] uppercase tracking-normal text-plum">Offer / discount</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  { id: "none", label: "No offer" },
                  { id: "percent", label: "% off" },
                  { id: "flat", label: "₹ off" },
                ] as const
              ).map((o) => (
                <Button variant="unstyled" size="unstyled"
                  key={o.id}
                  onClick={() => setOfferType(o.id)}
                  className={`w-fit rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-normal ring-1 ring-border transition-colors ${
                    offerType === o.id ? "bg-plum text-paper" : "bg-background text-quiet hover:bg-plum/10"
                  }`}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {offerType !== "none" ? (
              <input
                className={`${inputClass} mt-1.5`}
                type="number"
                inputMode="decimal"
                value={offerValue}
                onChange={(e) => setOfferValue(e.target.value)}
                placeholder={offerType === "percent" ? "10 (%)" : "200 (₹)"}
              />
            ) : null}
          </div>

          <div className="mt-3 rounded-xl bg-ink px-3 py-2.5 text-paper">
            <div className="flex justify-between font-mono text-xs text-quiet">
              <span>Amount</span>
              <span>{money(gross)}</span>
            </div>
            {discount > 0 ? (
              <div className="mt-1 flex justify-between font-mono text-xs text-quiet">
                <span>Offer</span>
                <span>- {money(discount)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between font-mono text-xs text-quiet">
              <span>Taxable value</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between font-mono text-xs text-quiet">
              <span>{gstType === "gst" ? `GST ${gstRate}%` : "GST"}</span>
              <span>{gstType === "gst" ? money(tax) : "—"}</span>
            </div>
            <div className="mt-1.5 flex items-end justify-between border-t border-paper/15 pt-1.5">
              <span className="font-mono text-xs uppercase tracking-normal text-quiet">
                Bill total
              </span>
              <span className="font-display text-2xl leading-none">{money(total)}</span>
            </div>
          </div>

          <Button variant="unstyled" size="unstyled"
            disabled={!canRaise || raise.isPending}
            onClick={() => raise.mutate()}
            className="mt-2 w-fit rounded-lg bg-leaf px-4 py-2 text-center font-body text-sm font-bold uppercase text-paper shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {editingId ? "Update invoice" : "Raise invoice"}
          </Button>
          {editingId ? (
            <div className="mt-1.5 flex justify-end">
              <Button variant="unstyled" size="unstyled"
                onClick={() => {
                  setEditingId(null);
                  setRows([emptyRow()]);
                  setFinalAmount("");
                }}
                className="w-fit rounded-lg bg-card px-3 py-1 font-mono text-xs uppercase tracking-normal text-quiet ring-1 ring-border transition-colors hover:bg-tomato/10 hover:text-tomato"
              >
              Cancel edit
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <>
          <Panel title="Bills" hint="tap a bill to view" hintTone="leaf">
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["pending", "paid", "all"] as const).map((f) => (
                <Button variant="unstyled" size="unstyled"
                  key={f}
                  onClick={() => setBillFilter(f)}
                  className={`w-fit rounded-lg px-3 py-1 font-mono text-xs uppercase tracking-normal ring-1 ring-border transition-colors ${
                    billFilter === f ? "bg-leaf text-paper" : "bg-background text-quiet hover:bg-leaf/10"
                  }`}
                >
                  {f === "pending" ? "Pending" : f === "paid" ? "Paid" : "All"}
                </Button>
              ))}
            </div>
            <input
              className="mx-auto mt-2 block w-full rounded-full border-2 border-cobalt/70 bg-cobalt/10 px-3.5 py-1.5 text-center font-mono text-[12px] text-ink shadow-lg shadow-cobalt/25 outline-none placeholder:text-quiet focus:border-cobalt focus:bg-cobalt/15"
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
              placeholder="🔍 Search bill — invoice no, customer, mobile, item"
            />
            <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-normal text-paper/70">
                <span>Invoice · customer</span>
                <span className="text-right">Type</span>
                <span className="text-right">Total</span>
              </div>
              {pending.length === 0 ? (
                <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">
                  No bills here.
                </div>
              ) : (
                pending.map((s, i) => (
                  <Button variant="unstyled" size="unstyled"
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`grid w-full grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-left text-[12px] ${
                      selected?.id === s.id
                        ? "bg-marigold/40"
                        : i % 2 === 0
                          ? "bg-background"
                          : "bg-card"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs text-quiet">
                        {s.invoice_no ?? "Direct bill"}
                      </span>
                      <span className="block truncate font-semibold">
                        {s.customer} · {s.item}
                      </span>
                    </span>
                    <span className="self-center text-right">
                      <span className="block font-mono text-[11px] uppercase tracking-normal">
                        {s.gst_type === "gst" ? `GST ${s.gst_rate}%` : s.gst_type === "direct" ? "Direct" : "No GST"}
                      </span>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-1.5 py-px font-mono text-[8px] uppercase tracking-normal ${
                          balanceOf(s) <= 0.005
                            ? "bg-leaf/15 text-leaf"
                            : Number(s.paid_amount ?? 0) > 0
                              ? "bg-marigold/30 text-ink"
                              : "bg-tomato/15 text-tomato"
                        }`}
                      >
                        {balanceOf(s) <= 0.005
                          ? `Paid · ${s.payment_mode === "credit" ? "settled" : s.payment_mode}`
                          : Number(s.paid_amount ?? 0) > 0
                            ? `Partial · due ${money(balanceOf(s))}`
                            : "Credit"}
                      </span>
                    </span>
                    <span className="self-center text-right font-mono font-semibold">
                      {money(s.total_amount)}
                    </span>
                  </Button>
                ))
              )}
            </div>
          </Panel>

          {selected ? (
            <div className="fixed inset-0 z-40 lg:pl-[420px]">
              <Button variant="unstyled" size="unstyled"
                aria-label="Close bill view"
                onClick={() => setSelectedId(null)}
                className="absolute inset-0 bg-ink/40"
              />
              <div className="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto bg-background p-3 shadow-2xl sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-normal text-quiet">
                    Viewing bill side by side
                  </span>
                  <Button variant="unstyled" size="unstyled"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg bg-tomato px-2.5 py-1 font-mono text-xs uppercase tracking-normal text-paper transition-transform active:scale-95"
                  >
                    ✕ Close
                  </Button>
                </div>
            <Panel
              title="Delivery & production"
              hint={selected.delivery_date ? `by ${new Date(selected.delivery_date).toLocaleDateString("en-GB")}` : "no delivery date"}
              hintTone="leaf"
              delay={40}
            >
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-normal ${
                    balanceOf(selected) > 0.005 ? "bg-tomato/15 text-tomato" : "bg-leaf/15 text-leaf"
                  }`}
                >
                  {balanceOf(selected) > 0.005
                    ? `Payment pending · due ${money(balanceOf(selected))}`
                    : "Payment settled"}
                </span>
                <span className="rounded-full bg-plum/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-normal text-plum">
                  {DELIVERY_LABEL[selected.delivery_option ?? "pickup"] ?? "Store pickup"}
                </span>
                {selected.delivery_date ? (
                  <span className="rounded-full bg-cobalt/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-normal text-cobalt">
                    Deliver by {new Date(selected.delivery_date).toLocaleDateString("en-GB")}
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 rounded-xl bg-background p-2.5 ring-1 ring-border">
                <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">
                  Production stages
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[...(STAGES as readonly string[]), "done"].map((st, myIdx) => {
                    const curIdx = selJob
                      ? [...(STAGES as readonly string[]), "done"].indexOf(selJob.stage)
                      : -1;
                    return (
                      <span
                        key={st}
                        className={`rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-normal ${
                          curIdx >= 0 && myIdx === curIdx
                            ? "bg-ink text-paper"
                            : curIdx >= 0 && myIdx < curIdx
                              ? "bg-leaf/15 text-leaf"
                              : "bg-card text-quiet ring-1 ring-border"
                        }`}
                      >
                        {STAGE_LABEL[st] ?? st}
                      </span>
                    );
                  })}
                </div>
                {!selJob ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <select
                      value={stageWorker}
                      onChange={(e) => setStageWorker(e.target.value)}
                      className="cursor-pointer appearance-none rounded-lg bg-background px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border"
                    >
                      <option value="">No worker yet</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="unstyled" size="unstyled"
                      disabled={startJob.isPending}
                      onClick={() => startJob.mutate(selected)}
                      className="w-fit rounded-lg bg-plum px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-paper transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Start cutting
                    </Button>
                  </div>
                ) : selJob.stage !== "done" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <select
                      value={stageWorker}
                      onChange={(e) => setStageWorker(e.target.value)}
                      className="cursor-pointer appearance-none rounded-lg bg-background px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-ink ring-1 ring-border"
                    >
                      <option value="">No worker change</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="unstyled" size="unstyled"
                      disabled={advanceJob.isPending}
                      onClick={() =>
                        advanceJob.mutate({ id: selJob.id, stage: nextStageOf(selJob.stage) })
                      }
                      className="w-fit rounded-lg bg-cobalt px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-paper transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {selJob.stage === "packing"
                        ? "Dispatch"
                        : `Move to ${STAGE_LABEL[nextStageOf(selJob.stage)] ?? nextStageOf(selJob.stage)}`}
                    </Button>
                    <span className="font-mono text-[10px] uppercase tracking-normal text-quiet">
                      {selJob.workers?.name ? `At ${selJob.workers.name}` : "No worker yet"}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-normal text-leaf">
                    Job dispatched
                  </p>
                )}
              </div>
            </Panel>
            <Panel title="Print bill" hint={selected.invoice_no ?? "Direct bill"} hintTone="cobalt" delay={70}>
              {balanceOf(selected) > 0.005 ? (
                <div className="mt-2.5 rounded-xl bg-tomato/10 p-2.5 ring-1 ring-tomato/20">
                  <div className="font-mono text-[11px] uppercase tracking-normal text-tomato">
                    Paid {money(Number(selected.paid_amount ?? 0))} · Balance{" "}
                    {money(balanceOf(selected))} — receive payment
                  </div>
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="number"
                    inputMode="decimal"
                    value={receiveAmt}
                    onChange={(e) => setReceiveAmt(e.target.value)}
                    placeholder={`Amount (full ${balanceOf(selected).toFixed(2)})`}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button variant="unstyled" size="unstyled"
                      disabled={settle.isPending}
                      onClick={() => settle.mutate({ sale: selected, mode: "cash" })}
                      className="w-fit rounded-lg bg-leaf px-3 py-1 font-mono text-xs uppercase tracking-normal text-paper transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Received cash
                    </Button>
                    <Button variant="unstyled" size="unstyled"
                      disabled={settle.isPending}
                      onClick={() => settle.mutate({ sale: selected, mode: "upi" })}
                      className="w-fit rounded-lg bg-cobalt px-3 py-1 font-mono text-xs uppercase tracking-normal text-paper transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Received UPI
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRINT_FORMATS.map((f) => (
                  <Button variant="unstyled" size="unstyled"
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`w-fit rounded-lg px-3 py-1.5 ring-1 ring-border ${
                      format === f.id ? "bg-cobalt text-paper" : "bg-background text-quiet"
                    }`}
                  >
                    <span className="block font-mono text-xs uppercase tracking-normal">
                      {f.label}
                    </span>
                    <span className="block font-mono text-[11px] opacity-70">{f.hint}</span>
                  </Button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button variant="unstyled" size="unstyled"
                  onClick={() => window.print()}
                  className="rounded-lg bg-ink px-3 py-2 text-center font-body text-xs font-bold uppercase text-paper"
                >
                  Print
                </Button>
                <Button variant="unstyled" size="unstyled"
                  onClick={() => downloadBillPdf(selected, shop ?? {})}
                  className="rounded-lg bg-cobalt px-3 py-2 text-center font-body text-xs font-bold uppercase text-paper"
                >
                  Download
                </Button>
                <Button variant="unstyled" size="unstyled"
                  onClick={() => shareOnWhatsApp(selected, shop ?? {})}
                  className="rounded-lg bg-leaf px-3 py-2 text-center font-body text-xs font-bold uppercase text-paper"
                >
                  WhatsApp
                </Button>
                <Button variant="unstyled" size="unstyled"
                  onClick={() => startEdit(selected)}
                  className="rounded-lg bg-marigold px-3 py-2 text-center font-body text-xs font-bold uppercase text-ink"
                >
                  Edit
                </Button>
              </div>
              <BillDetails sale={selected} />

              <div className="mt-3 overflow-x-auto rounded-xl bg-background p-3 ring-1 ring-border">
                <div id="invoice-print">
                  <InvoiceDoc sale={selected} shop={shop ?? {}} format={format} />
                </div>
              </div>

              <p className="mt-2 font-mono text-[11px] uppercase tracking-normal text-quiet">
                {num(selected.pieces)} pcs · taxable {money(selected.subtotal)} · tax{" "}
                {money(selected.tax_amount)}
              </p>
            </Panel>
              </div>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  label,
  hint,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  tone: "cobalt" | "leaf";
  onClick: () => void;
}) {
  const on = tone === "cobalt" ? "bg-cobalt text-paper" : "bg-leaf text-paper";
  return (
    <Button variant="unstyled" size="unstyled"
      onClick={onClick}
      className={`w-fit flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left ring-1 ring-border transition-colors ${
        active ? on : "bg-card text-quiet"
      }`}
    >
      <span className="block font-display text-sm uppercase tracking-normal">{label}</span>
      <span className="block font-mono text-[11px] uppercase tracking-normal opacity-70">{hint}</span>
    </Button>
  );
}

function BillDetails({ sale }: { sale: InvoiceSale }) {
  const s = sale as InvoiceSale & {
    design_path?: string | null;
    attachment_path?: string | null;
    voice_note_path?: string | null;
    design_notes?: string | null;
    staff_name?: string | null;
    customer_phone?: string | null;
  };
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setDesignUrl(null);
    setVoiceUrl(null);
    const sign = async (p: string | null | undefined, set: (u: string) => void) => {
      if (!p) return;
      const { data } = await supabase.storage.from("bill-files").createSignedUrl(p, 3600);
      if (live && data?.signedUrl) set(data.signedUrl);
    };
    void sign(s.design_path, setDesignUrl);
    void sign(s.voice_note_path, setVoiceUrl);
    return () => {
      live = false;
    };
  }, [s.id, s.design_path, s.voice_note_path]);
  const isImage = (p?: string | null) => !!p && /\.(png|jpe?g|gif|webp|svg)$/i.test(p);
  const lines = itemsOf(s);
  return (
    <div className="mt-2.5 space-y-2 rounded-xl bg-background p-3 text-[12px] ring-1 ring-border">
      <div className="font-mono text-[11px] uppercase tracking-normal text-quiet">Bill details</div>
      <div className="grid grid-cols-2 gap-1">
        <span className="text-quiet">Customer</span>
        <span className="font-semibold">{s.customer}</span>
        <span className="text-quiet">Mobile</span>
        <span>{s.customer_phone || "—"}</span>
        <span className="text-quiet">Billed by</span>
        <span>{s.staff_name || "—"}</span>
        <span className="text-quiet">Date</span>
        <span>{new Date(s.created_at).toLocaleString("en-IN")}</span>
      </div>
      <div>
        <div className="text-quiet">Items</div>
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between font-mono text-[11px]">
            <span>{l.item} × {l.pieces}</span>
            <span>{money(l.pieces * l.rate)}</span>
          </div>
        ))}
      </div>
      {s.design_notes ? (
        <div>
          <div className="text-quiet">Design & details</div>
          <p className="whitespace-pre-wrap">{s.design_notes}</p>
        </div>
      ) : null}
      {s.design_path ? (
        <div>
          <div className="text-quiet">Design</div>
          {isImage(s.design_path) && designUrl ? (
            <img src={designUrl} alt="Design" className="mt-1 max-h-64 rounded-lg ring-1 ring-border" />
          ) : null}
          <Button variant="unstyled" size="unstyled" onClick={() => { if (s.design_path) void openBillFile(s.design_path); }} className="mt-1 w-fit rounded-lg bg-plum/15 px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-plum">
            Open design file
          </Button>
        </div>
      ) : null}
      {s.attachment_path ? (
        <Button variant="unstyled" size="unstyled" onClick={() => { if (s.attachment_path) void openBillFile(s.attachment_path); }} className="w-fit rounded-lg bg-leaf/15 px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-leaf">
          Open Excel file
        </Button>
      ) : null}
      {voiceUrl ? <audio controls src={voiceUrl} className="w-full" /> : null}
    </div>
  );
}
