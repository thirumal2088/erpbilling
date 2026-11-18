import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, FieldBox, Panel, inputClass } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-admin";
import { money, num, STAGE_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Daily, weekly & monthly reports — RAINBOW ERP" },
      { name: "description", content: "Download or print daily, weekly and monthly sales, purchase, stock, expense and wage reports as PDF." },
      { property: "og:title", content: "Reports — RAINBOW ERP" },
      { property: "og:description", content: "Daily, weekly and monthly business reports with profit, expenses and wages as PDF or print." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Period = "daily" | "weekly" | "monthly";

function range(period: Period, dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  let start = new Date(d);
  let end = new Date(d);
  if (period === "daily") end.setDate(end.getDate() + 1);
  if (period === "weekly") {
    const day = (d.getDay() + 6) % 7; // Monday start
    start.setDate(d.getDate() - day);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  }
  if (period === "monthly") {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return { start, end };
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const rs = (v: number | string | null) =>
  "Rs. " + Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusOf = (r: { total_amount: number; paid_amount: number; payment_mode: string }) => {
  const bal = Number(r.total_amount) - Number(r.paid_amount);
  if (bal <= 0.005) return `Paid ${r.payment_mode === "credit" ? "" : r.payment_mode.toUpperCase()}`.trim();
  return Number(r.paid_amount) > 0 ? `Partial (due ${rs(bal)})` : "Credit";
};

const EXPENSE_CATEGORIES = [
  { value: "other", label: "Other" },
  { value: "rent", label: "Rent" },
  { value: "power", label: "Power bill" },
  { value: "transport", label: "Transport" },
  { value: "salary", label: "Salary / wages" },
  { value: "repairs", label: "Repairs" },
  { value: "tea_food", label: "Tea & food" },
];

type ExpenseRow = {
  id: string;
  category: string;
  note: string | null;
  amount: number;
  created_at: string;
};

type JobRow = { id: string; pieces: number; worker_id: string | null };

function ReportsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [period, setPeriod] = useState<Period>("daily");
  const [date, setDate] = useState(today);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [expCategory, setExpCategory] = useState("other");
  const [expNote, setExpNote] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [billsMonth, setBillsMonth] = useState("");
  const { start, end } = useMemo(() => range(period, date), [period, date]);

  const { data } = useQuery({
    queryKey: ["report", period, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const [s, p, m, e, j, w, pr] = await Promise.all([
        supabase.from("sales").select("*").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at"),
        supabase.from("purchases").select("*, materials(name)").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at"),
        supabase.from("materials").select("*").order("name"),
        supabase.from("expenses").select("*").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at"),
        supabase.from("work_jobs").select("*, workers(name)").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at"),
        supabase.from("workers").select("*").order("name"),
        supabase.auth.getUser().then(({ data: auth }) =>
          supabase.from("profiles").select("*").eq("id", auth.user?.id ?? "").maybeSingle(),
        ),
      ]);
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return {
        sales: s.data ?? [],
        purchases: p.data ?? [],
        materials: m.data ?? [],
        expenses: (e.data ?? []) as ExpenseRow[],
        jobs: (j.data ?? []) as unknown as JobRow[],
        workers: w.data ?? [],
        profile: pr.data,
      };
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["report-bills", billsMonth],
    queryFn: async () => {
      const query = supabase.from("sales").select("*");
      const filteredQuery = billsMonth
        ? (() => {
            const { start: monthStart, end: monthEnd } = range("monthly", `${billsMonth}-01`);
            return query.gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString());
          })()
        : query;
      const { data: rows, error } = await filteredQuery.order("created_at", { ascending: false });
      if (error) throw error;
      return rows ?? [];
    },
  });

  const sales = data?.sales ?? [];
  const purchases = data?.purchases ?? [];
  const materials = data?.materials ?? [];
  const expenses = data?.expenses ?? [];
  const jobs = data?.jobs ?? [];
  const workers = data?.workers ?? [];

  // Reward points: 1 gold point per Rs.100 of purchases, grouped by mobile number
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; total: number; bills: number }>();
    for (const s of sales) {
      const phone = (s.customer_phone ?? "").trim();
      const key = phone || `name:${s.customer.trim().toLowerCase()}`;
      const cur = map.get(key) ?? { name: s.customer, phone, total: 0, bills: 0 };
      cur.total += Number(s.total_amount);
      cur.bills += 1;
      if (!cur.phone && phone) cur.phone = phone;
      map.set(key, cur);
    }
    return [...map.values()]
      .map((c) => ({ ...c, points: Math.floor(c.total / 100) }))
      .sort((a, b) => b.total - a.total);
  }, [sales]);
  const totalPoints = customers.reduce((a, c) => a + c.points, 0);
  const totals = {
    sales: sales.reduce((a, r) => a + Number(r.total_amount), 0),
    tax: sales.reduce((a, r) => a + Number(r.tax_amount), 0),
    pieces: sales.reduce((a, r) => a + Number(r.pieces), 0),
    purchases: purchases.reduce((a, r) => a + Number(r.total_amount), 0),
    kg: purchases.reduce((a, r) => a + Number(r.qty_kg), 0),
    unpaid: purchases.filter((r) => !r.paid).reduce((a, r) => a + Number(r.total_amount), 0),
  };
  const expensesTotal = expenses.reduce((a, r) => a + Number(r.amount), 0);
  const profit = totals.sales - totals.purchases - expensesTotal;

  // Wage totals from the jobs assigned to each worker in this period
  const wages = useMemo(() => {
    const map = new Map<string, { name: string; stage: string; rate: number; pieces: number; wage: number }>();
    for (const w of workers)
      map.set(w.id, { name: w.name, stage: w.stage, rate: Number(w.rate_per_piece ?? 0), pieces: 0, wage: 0 });
    for (const j of jobs) {
      const w = j.worker_id ? map.get(j.worker_id) : undefined;
      if (!w) continue;
      w.pieces += Number(j.pieces);
      w.wage += Number(j.pieces) * w.rate;
    }
    return [...map.values()].sort((a, b) => b.wage - a.wage);
  }, [workers, jobs]);
  const wagesTotal = wages.reduce((a, w) => a + w.wage, 0);

  const addExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        category: expCategory,
        note: expNote.trim() || null,
        amount: Number(expAmount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setExpNote("");
      setExpAmount("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense removed");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastDay = new Date(end.getTime() - 86400000);
  const label = `${period.toUpperCase()} REPORT  ·  ${period === "daily" ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(lastDay)}`}`;

  function buildPdf() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold").setFontSize(18).text("RAINBOW ERP", 14, 16);
    doc.setFontSize(10).setFont("helvetica", "normal");
    doc.text(data?.profile?.unit_name ?? "", 14, 22);
    doc.setFont("helvetica", "bold").text(label, 14, 29);
    autoTable(doc, {
      startY: 34,
      head: [["Summary", "Value"]],
      body: [
        ["Sales total", rs(totals.sales)],
        ["GST collected", rs(totals.tax)],
        ["Pieces sold", String(totals.pieces)],
        ["Purchases total", rs(totals.purchases)],
        ["Material bought (kg)", totals.kg.toFixed(2)],
        ["Unpaid purchases", rs(totals.unpaid)],
        ["Expenses", rs(expensesTotal)],
        ["Net profit (sales - purchases - expenses)", rs(profit)],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 30, 30] },
    });
    const y = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.text("Sales", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Date", "Invoice", "Customer", "Item", "Pcs", "Offer", "GST", "Total", "Status"]],
      body: sales.map((r) => [fmtDate(r.created_at), r.invoice_no ?? "", r.customer, r.item, r.pieces, rs(r.discount_amount), rs(r.tax_amount), rs(r.total_amount), statusOf(r)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 130, 80] },
    });
    doc.text("Purchases", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Date", "Supplier", "Material", "Kg", "Rate/kg", "Total", "Paid"]],
      body: purchases.map((r) => [fmtDate(r.created_at), r.supplier, (r.materials as { name: string } | null)?.name ?? "", Number(r.qty_kg).toFixed(2), rs(r.rate_per_kg), rs(r.total_amount), r.paid ? "Yes" : "No"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [210, 150, 30] },
    });
    doc.text("Current stock", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Material", "Stock kg", "Reorder kg", "Status"]],
      body: materials.map((m) => [m.name, Number(m.stock_kg).toFixed(2), Number(m.reorder_kg).toFixed(2), Number(m.stock_kg) <= Number(m.reorder_kg) ? "LOW" : "OK"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [50, 80, 200] },
    });
    doc.text("Customer reward points (1 gold point per Rs.100)", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Customer", "Mobile", "Bills", "Total purchase", "Gold points"]],
      body: customers.map((c) => [c.name, c.phone || "-", String(c.bills), rs(c.total), String(c.points)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [180, 120, 10] },
    });
    doc.text("Worker wages (rate per piece)", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Worker", "Station", "Rate/pc", "Pieces", "Wage"]],
      body: wages.map((w) => [w.name, STAGE_LABEL[w.stage] ?? w.stage, w.rate.toFixed(2), String(w.pieces), rs(w.wage)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [90, 60, 130] },
    });
    doc.text("Expenses", 14, y() - 2);
    autoTable(doc, {
      startY: y(),
      head: [["Date", "Category", "Note", "Amount"]],
      body: expenses.map((r) => [fmtDate(r.created_at), r.category, r.note ?? "", rs(r.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [120, 40, 40] },
    });
    return doc;
  }

  const download = () => buildPdf().save(`rainbow-${period}-report-${start.toLocaleDateString("en-CA")}.pdf`);
  const print = () => {
    const doc = buildPdf();
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <AppShell>
      <Panel title="Reports" hint={label}>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider ${period === p ? "bg-ink text-paper shadow-[0_2px_0_0_rgba(0,0,0,0.25)]" : "bg-paper text-ink ring-1 ring-black/10"}`}
            >
              {p}
            </button>
          ))}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} max-w-[180px]`} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <Stat k="Sales" v={money(totals.sales)} />
          <Stat k="Purchases" v={money(totals.purchases)} />
          <Stat k="Expenses" v={money(expensesTotal)} />
          <Stat k={profit >= 0 ? "Profit" : "Loss"} v={money(Math.abs(profit))} />
          <Stat k="GST" v={money(totals.tax)} />
          <Stat k="Kg bought" v={num(totals.kg)} />
        </div>
        <p className="mt-3 font-mono text-[11px] text-quiet">
          {sales.length} invoices · {purchases.length} purchases · {expenses.length} expenses · {materials.length} materials in stock list
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={download} className="rounded-xl bg-leaf px-4 py-3 text-sm font-bold uppercase text-paper">
            Download PDF
          </button>
          <button onClick={print} className="rounded-xl bg-cobalt px-4 py-3 text-sm font-bold uppercase text-paper">
            Print
          </button>
        </div>
      </Panel>
      <Panel title="All bills" hint={`${bills.length} ${billsMonth ? `in ${billsMonth}` : "total"}`} hintTone="leaf" delay={70}>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <FieldBox label="Filter by month">
            <input
              type="month"
              value={billsMonth}
              onChange={(event) => setBillsMonth(event.target.value)}
              className={`${inputClass} w-fit`}
              aria-label="Filter bills by month"
            />
          </FieldBox>
          {billsMonth ? (
            <Button
              variant="unstyled"
              size="compact"
              onClick={() => setBillsMonth("")}
              className="mb-0.5 bg-card text-ink ring-1 ring-border"
            >
              All months
            </Button>
          ) : null}
        </div>
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          {bills.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">No bills {billsMonth ? "in this month." : "recorded yet."}</div>
          ) : (
            bills.map((s, i) => (
              <div key={s.id} className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-[12px] ${i % 2 ? "bg-card" : "bg-background"}`}>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] text-quiet">{s.invoice_no ?? "Direct bill"} · {fmtDate(s.created_at)} · {statusOf(s)}</span>
                  <span className="block truncate font-semibold">{s.customer} · {s.item}</span>
                </span>
                <span className="self-center font-mono font-semibold">{money(s.total_amount)}</span>
                <Button
                  variant="unstyled"
                  size="compact"
                  onClick={() => navigate({ to: "/sales", search: { edit: s.id } })}
                  className="self-center bg-cobalt font-mono uppercase text-paper"
                >
                  Update
                </Button>
              </div>
            ))
          )}
        </div>
      </Panel>
      <Panel
        title="Expenses & profit"
        hint={`net ${profit >= 0 ? "+" : "-"}${money(Math.abs(profit))}`}
        hintTone={profit >= 0 ? "leaf" : "tomato"}
        delay={120}
      >
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          {expenses.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">No expenses recorded in this period.</div>
          ) : (
            expenses.map((r, i) => (
              <div key={r.id} className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-[12px] ${i % 2 ? "bg-card" : "bg-background"}`}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.note || r.category}</span>
                  <span className="block font-mono text-[10px] text-quiet">{r.category} · {fmtDate(r.created_at)}</span>
                </span>
                <span className="font-mono font-semibold">{money(r.amount)}</span>
                {isAdmin ? (
                  <button
                    onClick={() => removeExpense.mutate(r.id)}
                    className="rounded-lg bg-tomato/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-tomato"
                    aria-label={`Delete ${r.category} expense`}
                  >
                    Del
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))
          )}
        </div>
        {isAdmin ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FieldBox label="Category">
                <select
                  className={inputClass}
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FieldBox>
              <FieldBox label="Amount">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="250"
                />
              </FieldBox>
              <FieldBox label="Note (optional)" className="col-span-2">
                <input
                  className={inputClass}
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="Auto driver to Erode"
                />
              </FieldBox>
            </div>
            <button
              disabled={addExpense.isPending || !expAmount.trim() || !(Number(expAmount) > 0)}
              onClick={() => addExpense.mutate()}
              className="mt-2.5 w-full rounded-xl bg-tomato py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-50"
            >
              Add expense
            </button>
          </>
        ) : (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-quiet">
            View only · ask an admin to add expenses
          </p>
        )}
      </Panel>
      <Panel title="Worker wages" hint={`total ${money(wagesTotal)}`} hintTone="cobalt" delay={160}>
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          {wages.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">No workers on roll yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
                <span>Worker</span>
                <span className="text-right">Rate/pc</span>
                <span className="text-right">Pcs</span>
                <span className="text-right">Wage</span>
              </div>
              {wages.map((w, i) => (
                <div key={w.name} className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[12px] ${i % 2 ? "bg-card" : "bg-background"}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block font-mono text-[10px] text-quiet">{STAGE_LABEL[w.stage] ?? w.stage}</span>
                  </span>
                  <span className="text-right font-mono text-quiet">{num(w.rate)}</span>
                  <span className="text-right font-mono">{num(w.pieces)}</span>
                  <span className="text-right font-mono font-semibold">{money(w.wage)}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] text-quiet">
          Pieces come from the jobs assigned to each worker in this period. Set each rate on the Workers page.
        </p>
      </Panel>
      <Panel title="Customers & reward points" hint={`1 gold point per ₹100 · ${totalPoints} points given`} hintTone="tomato" delay={200}>
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          {customers.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">No customers in this period.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-ink px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-paper">
                <span>Customer</span>
                <span>Total purchase</span>
                <span>Points</span>
              </div>
              {customers.map((c, i) => (
                <div key={c.phone || c.name} className={`grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[12px] ${i % 2 ? "bg-card" : "bg-background"}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block font-mono text-[10px] text-quiet">{c.phone || "no mobile"} · {c.bills} bill{c.bills === 1 ? "" : "s"}</span>
                  </span>
                  <span className="self-center font-mono font-semibold">{money(c.total)}</span>
                  <span className="self-center rounded-full bg-marigold/25 px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink">★ {c.points}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-paper p-3 ring-1 ring-black/5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-quiet">{k}</div>
      <div className="font-display text-xl">{v}</div>
    </div>
  );
}
