import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, FieldBox, Panel, inputClass } from "@/components/AppShell";
import { money, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/purchase")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Purchase by kilo — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Record raw material bought from suppliers by weight: enter kilos and rate per kilo, the total and material stock update automatically.",
      },
      { property: "og:title", content: "Purchase by kilo — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Enter kilos and rate per kilo; stock and supplier dues update on their own.",
      },
    ],
  }),
  component: PurchasePage,
});

function PurchasePage() {
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [ratePerKg, setRatePerKg] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [paid, setPaid] = useState(false);

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, materials(name, rack_location)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const total = (Number(qtyKg) || 0) * (Number(ratePerKg) || 0);

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchases").insert({
        supplier: supplier.trim(),
        material_id: materialId,
        qty_kg: Number(qtyKg),
        rate_per_kg: Number(ratePerKg),
        paid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase recorded");
      setQtyKg("");
      setRatePerKg("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("purchases").update({ paid: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const canPost = supplier.trim() && materialId && Number(qtyKg) > 0 && Number(ratePerKg) >= 0;

  return (
    <AppShell>
      <Panel title="Purchase · kg" hint="Auto total" hintTone="cobalt">
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FieldBox label="Supplier" className="col-span-2">
            <input
              className={inputClass}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Meera Yarn Traders"
            />
          </FieldBox>
          <FieldBox label="Material">
            <select
              className={inputClass}
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              <option value="">Select</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FieldBox>
          <FieldBox label="Rate / kg">
            <input
              className={inputClass}
              inputMode="decimal"
              value={ratePerKg}
              onChange={(e) => setRatePerKg(e.target.value)}
              placeholder="218"
            />
          </FieldBox>
          <FieldBox label="Quantity (kg)" className="col-span-2">
            <input
              className={inputClass}
              inputMode="decimal"
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
              placeholder="540"
            />
          </FieldBox>
        </div>

        <label className="mt-2 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-widest text-quiet">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Paid to supplier
        </label>

        <div className="mt-3 flex items-end justify-between rounded-xl bg-ink px-3 py-2.5 text-paper">
          <span className="font-mono text-[10px] uppercase tracking-widest text-quiet">Total ₹</span>
          <span className="font-display text-2xl leading-none">{money(total)}</span>
        </div>
        <button
          disabled={!canPost || post.isPending}
          onClick={() => post.mutate()}
          className="mt-2.5 w-full rounded-xl bg-cobalt py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-50"
        >
          Post purchase
        </button>
        {materials.length === 0 ? (
          <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-tomato">
            Add a material on the Stock page first
          </p>
        ) : null}
      </Panel>

      <Panel title="Recent purchases" hint="kg" delay={70}>
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
            <span>Supplier · material</span>
            <span className="text-right">Kg × rate</span>
            <span className="text-right">Total</span>
          </div>
          {purchases.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">
              No purchases recorded yet.
            </div>
          ) : (
            purchases.map((p, i) => (
              <button
                key={p.id}
                onClick={() => togglePaid.mutate({ id: p.id, value: !p.paid })}
                className={`grid w-full grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-left text-[12px] ${
                  i % 2 === 0 ? "bg-background" : "bg-card"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.supplier}</span>
                  <span className="block truncate font-mono text-[10px] text-quiet">
                    {(p.materials as { name: string; rack_location?: string | null } | null)?.name}
                    {(p.materials as { rack_location?: string | null } | null)?.rack_location
                      ? ` · rack ${(p.materials as { rack_location?: string | null } | null)!.rack_location}`
                      : ""}{" "}
                    ·{" "}
                    {p.paid ? "paid" : "unpaid — tap to settle"}
                  </span>
                </span>
                <span className="text-right font-mono">
                  {num(p.qty_kg)} × {num(p.rate_per_kg)}
                </span>
                <span
                  className={`text-right font-mono font-semibold ${
                    p.paid ? "text-leaf" : "text-tomato"
                  }`}
                >
                  {money(p.total_amount)}
                </span>
              </button>
            ))
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
