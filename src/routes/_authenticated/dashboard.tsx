import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { money, num, STAGES, STAGE_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Today's book — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Live view of material stock in kilos, today's piece sales, work in progress and open supplier payments.",
      },
      { property: "og:title", content: "Today's book — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Stock in kg, sales in pieces, work in progress and open payments at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const STAGE_BG: Record<string, string> = {
  cutting: "bg-plum text-paper",
  stitching: "bg-cobalt text-paper",
  finishing: "bg-marigold text-ink",
  packing: "bg-leaf text-paper",
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(weeksAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow - weeksAgo * 7);
  return d;
}

type DatedRow = { created_at: string; total_amount: number | string };

function WeekCompareChart({ sales, purchases }: { sales: DatedRow[]; purchases: DatedRow[] }) {
  const [metric, setMetric] = useState<"sales" | "purchases">("sales");
  const rows = metric === "sales" ? sales : purchases;

  const data = useMemo(() => {
    const thisStart = mondayOf(0).getTime();
    const lastStart = mondayOf(1).getTime();
    const lastEnd = thisStart;
    const days = DAY_NAMES.map((day) => ({ day, thisWeek: 0, lastWeek: 0 }));
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const amt = Number(r.total_amount);
      if (t >= thisStart) {
        const d = days[Math.min(6, Math.floor((t - thisStart) / 86400000))];
        if (d) d.thisWeek += amt;
      } else if (t >= lastStart && t < lastEnd) {
        const d = days[Math.floor((t - lastStart) / 86400000)];
        if (d) d.lastWeek += amt;
      }
    }
    return days;
  }, [rows]);

  const thisTotal = data.reduce((s, d) => s + d.thisWeek, 0);
  const lastTotal = data.reduce((s, d) => s + d.lastWeek, 0);
  const diff = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : null;

  return (
    <div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["sales", "purchases"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest ${
                metric === m ? "bg-ink text-paper" : "bg-card text-quiet ring-1 ring-black/5"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {diff !== null && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
              diff >= 0 ? "bg-leaf/15 text-leaf" : "bg-tomato/15 text-tomato"
            }`}
          >
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(0)}% vs last week
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-3 font-mono text-[10px] text-quiet">
        <span>This week <b className="text-ink">{money(thisTotal)}</b></span>
        <span>Last week <b className="text-ink">{money(lastTotal)}</b></span>
      </div>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [money(v), name === "thisWeek" ? "This week" : "Last week"]}
              contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)" }}
            />
            <Legend
              formatter={(v: string) => (v === "thisWeek" ? "This week" : "Last week")}
              wrapperStyle={{ fontSize: 10 }}
            />
            <Bar dataKey="lastWeek" fill="oklch(0.78 0.155 76)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="thisWeek" fill="oklch(0.45 0.18 264)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
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
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["work_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_jobs")
        .select("*, workers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const since = startOfToday();
  const [showStock, setShowStock] = useState(true);
  const totalStock = materials.reduce((s, m) => s + Number(m.stock_kg), 0);
  const kgToday = purchases
    .filter((p) => p.created_at >= since)
    .reduce((s, p) => s + Number(p.qty_kg), 0);
  const todaySales = sales.filter((s) => s.created_at >= since);
  const salesToday = todaySales.reduce((s, r) => s + Number(r.total_amount), 0);
  const piecesToday = todaySales.reduce((s, r) => s + Number(r.pieces), 0);
  const wip = jobs.filter((j) => j.stage !== "done");
  const wipPieces = wip.reduce((s, j) => s + Number(j.pieces), 0);
  const payables = purchases.filter((p) => !p.paid);
  const payableTotal = payables.reduce((s, p) => s + Number(p.total_amount), 0);
  const suppliers = new Set(payables.map((p) => p.supplier)).size;
  const lowStock = materials.filter(
    (m) => Number(m.reorder_kg) > 0 && Number(m.stock_kg) < Number(m.reorder_kg),
  );
  const lowNeed = (m: { stock_kg: number; reorder_kg: number }) =>
    Math.max(0, Number(m.reorder_kg) - Number(m.stock_kg));

  return (
    <AppShell>
      <section className="rise grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-cobalt p-3.5 text-paper">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
            Stock in
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{num(totalStock)}</div>
          <div className="mt-1 font-mono text-[10px] text-paper/70">
            kg · +{num(kgToday)} today
          </div>
        </div>
        <div className="rounded-2xl bg-tomato p-3.5 text-paper">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
            Sales today
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{money(salesToday)}</div>
          <div className="mt-1 font-mono text-[10px] text-paper/70">
            {num(piecesToday)} pcs · {todaySales.length} bills
          </div>
        </div>
        <div className="rounded-2xl bg-marigold p-3.5 text-ink">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/70">
            WIP pieces
          </div>
          <div className="mt-1.5 font-display text-[26px] leading-none">{num(wipPieces)}</div>
          <div className="mt-1 font-mono text-[10px] text-ink/70">across 4 stages</div>
        </div>
        <div className="rounded-2xl bg-card p-3.5 ring-1 ring-black/5">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-quiet">
            Payables
          </div>
          <div className="mt-1.5 font-display text-[26px] leading-none">{money(payableTotal)}</div>
          <div className="mt-1 font-mono text-[10px] text-quiet">{suppliers} suppliers</div>
        </div>
      </section>

      <Panel title="Week vs week" hint="sales & purchases" delay={40}>
        <WeekCompareChart sales={sales} purchases={purchases} />
      </Panel>

      <Panel title="Material stock" hint="kg" delay={70}>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-tomato" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-quiet">
            Low flag · below reorder
          </span>
        </div>
        <button
          onClick={() => setShowStock((v) => !v)}
          className={`mt-2 w-full rounded-xl py-2 font-mono text-[10px] uppercase tracking-widest ring-1 ring-black/5 ${showStock ? "bg-ink text-paper" : "bg-cobalt text-paper"}`}
        >
          {showStock ? "Hide stock details" : `Show stock details (${materials.length})`}
        </button>
        {showStock ? (
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
            <span>Material</span>
            <span className="text-right">Kg</span>
            <span className="text-right">Reorder</span>
          </div>
          {materials.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">
              No materials yet — add them on the Stock page.
            </div>
          ) : (
            materials.map((m, i) => {
              const low = Number(m.stock_kg) < Number(m.reorder_kg);
              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[12px] ${
                    low ? "bg-tomato/10" : i % 2 === 0 ? "bg-background" : "bg-card"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    {low ? <span className="h-1.5 w-1.5 rounded-full bg-tomato" /> : null}
                    {m.name}
                  </span>
                  <span
                    className={`text-right font-mono ${low ? "text-tomato" : ""}`}
                  >
                    {num(m.stock_kg)}
                  </span>
                  <span className={`text-right font-mono ${low ? "" : "text-leaf"}`}>
                    {num(m.reorder_kg)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        ) : null}
      </Panel>

      {lowStock.length > 0 ? (
        <Panel
          title="Low stock alerts"
          hint={`reorder ${lowStock.length} material${lowStock.length === 1 ? "" : "s"}`}
          hintTone="tomato"
          delay={110}
        >
          <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-tomato px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper">
              <span>Material</span>
              <span className="text-right">In stock</span>
              <span className="text-right">Reorder at</span>
              <span className="text-right">Buy now</span>
            </div>
            {lowStock.map((m, i) => (
              <div
                key={m.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[12px] ${
                  i % 2 === 0 ? "bg-background" : "bg-card"
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-tomato" />
                  {m.name}
                </span>
                <span className="text-right font-mono text-tomato">{num(m.stock_kg)}</span>
                <span className="text-right font-mono text-quiet">{num(m.reorder_kg)}</span>
                <span className="text-right font-mono font-semibold">{num(lowNeed(m))} kg</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-quiet">
            Last paid rates are on the Stock page — add the purchase there.
          </p>
        </Panel>
      ) : null}

      <Panel title="Worker stages" hint="pcs" delay={140}>
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {STAGES.map((stage, i) => {
            const stageJobs = wip.filter((j) => j.stage === stage);
            const pieces = stageJobs.reduce((s, j) => s + Number(j.pieces), 0);
            const names = Array.from(
              new Set(
                stageJobs
                  .map((j) => (j.workers as { name: string } | null)?.name)
                  .filter(Boolean) as string[],
              ),
            );
            return (
              <div
                key={stage}
                className={`slide-x w-32 shrink-0 rounded-xl p-3 ${STAGE_BG[stage]}`}
                style={{ animationDelay: `${180 + i * 50}ms` }}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-70">
                  {STAGE_LABEL[stage]}
                </div>
                <div className="mt-1 font-display text-[24px] leading-none">{num(pieces)}</div>
                <div className="mt-1 truncate font-mono text-[9px] opacity-70">
                  {names[0] ?? "Unassigned"} · {stageJobs.length} jobs
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
