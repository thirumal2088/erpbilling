import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, FieldBox, Panel, inputClass } from "@/components/AppShell";
import { money, num } from "@/lib/format";
import { useIsAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Material stock in kg — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Every raw material with its live weight in kilos, reorder level, low-stock flag and last purchase rate per kilo.",
      },
      { property: "og:title", content: "Material stock in kg — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Live weight in kilos, reorder levels and low-stock flags for every material.",
      },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [name, setName] = useState("");
  const [openingKg, setOpeningKg] = useState("");
  const [reorderKg, setReorderKg] = useState("");
  const [rack, setRack] = useState("");
  const [showStock, setShowStock] = useState(true);

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("materials").insert({
        name: name.trim(),
        stock_kg: Number(openingKg) || 0,
        reorder_kg: Number(reorderKg) || 0,
        rack_location: rack.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material added");
      setName("");
      setOpeningKg("");
      setReorderKg("");
      setRack("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ id, stock_kg }: { id: string; stock_kg: number }) => {
      const { error } = await supabase.from("materials").update({ stock_kg }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  const setRackLoc = useMutation({
    mutationFn: async ({ id, rack_location }: { id: string; rack_location: string | null }) => {
      const { error } = await supabase.from("materials").update({ rack_location }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  const totalKg = materials.reduce((s, m) => s + Number(m.stock_kg), 0);
  const lowCount = materials.filter((m) => Number(m.stock_kg) < Number(m.reorder_kg)).length;

  return (
    <AppShell>
      <section className="rise grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-cobalt p-3.5 text-paper">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
            Total stock
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{num(totalKg)}</div>
          <div className="mt-1 font-mono text-[10px] text-paper/70">kg on floor</div>
        </div>
        <div className="rounded-2xl bg-tomato p-3.5 text-paper">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
            Below reorder
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{lowCount}</div>
          <div className="mt-1 font-mono text-[10px] text-paper/70">materials to buy</div>
        </div>
      </section>

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
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
            <span>Material</span>
            <span className="text-right">Rack</span>
            <span className="text-right">Kg</span>
            <span className="text-right">Reorder</span>
            <span className="text-right">Rate</span>
          </div>
          {materials.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">
              Add your first material below.
            </div>
          ) : (
            materials.map((m, i) => {
              const low = Number(m.stock_kg) < Number(m.reorder_kg);
              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2 text-[12px] ${
                    low ? "bg-tomato/10" : i % 2 === 0 ? "bg-background" : "bg-card"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate font-semibold">
                    {low ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tomato" /> : null}
                    {m.name}
                  </span>
                  <input
                    key={`${m.id}-rack-${m.rack_location ?? ""}`}
                    className="w-14 bg-transparent text-right font-mono text-[10px] outline-none"
                    defaultValue={m.rack_location ?? ""}
                    placeholder="—"
                    readOnly={!isAdmin}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (m.rack_location ?? "")) {
                        setRackLoc.mutate({ id: m.id, rack_location: v || null });
                      }
                    }}
                  />
                  <input
                    key={`${m.id}-${m.stock_kg}`}
                    className={`w-16 bg-transparent text-right font-mono outline-none ${
                      low ? "text-tomato" : ""
                    }`}
                    defaultValue={Number(m.stock_kg)}
                    inputMode="decimal"
                    readOnly={!isAdmin}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== Number(m.stock_kg)) {
                        adjust.mutate({ id: m.id, stock_kg: v });
                      }
                    }}
                  />
                  <span className={`text-right font-mono ${low ? "" : "text-leaf"}`}>
                    {num(m.reorder_kg)}
                  </span>
                  <span className="text-right font-mono text-quiet">
                    {money(m.last_rate_per_kg)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        ) : null}
        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-quiet">
          {isAdmin
            ? "Tap a kg value to correct it after a physical count"
            : "View only · ask an admin to change stock"}
        </p>
      </Panel>

      {!isAdmin ? null : (
      <Panel title="Add material" hint="admin only" delay={140}>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FieldBox label="Material name" className="col-span-2">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cotton 40s"
            />
          </FieldBox>
          <FieldBox label="Opening (kg)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={openingKg}
              onChange={(e) => setOpeningKg(e.target.value)}
              placeholder="0"
            />
          </FieldBox>
          <FieldBox label="Reorder (kg)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={reorderKg}
              onChange={(e) => setReorderKg(e.target.value)}
              placeholder="500"
            />
          </FieldBox>
          <FieldBox label="Rack location" className="col-span-2">
            <input
              className={inputClass}
              value={rack}
              onChange={(e) => setRack(e.target.value)}
              placeholder="Rack A3 · Shelf 2"
            />
          </FieldBox>
        </div>
        <button
          disabled={!name.trim() || add.isPending}
          onClick={() => add.mutate()}
          className="mt-2.5 w-full rounded-xl bg-ink py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-50"
        >
          Add material
        </button>
      </Panel>
      )}
    </AppShell>
  );
}
