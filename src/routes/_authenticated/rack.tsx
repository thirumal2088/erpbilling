import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/rack")({
  head: () => ({
    meta: [
      { title: "Material rack locations — RAINBOW ERP" },
      {
        name: "description",
        content: "Find each garment material by rack location and check its available stock in kilograms.",
      },
      { property: "og:title", content: "Material rack locations — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Material rack locations and available stock at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RackPage,
});

function RackPage() {
  const [search, setSearch] = useState("");
  const { isAdmin } = useIsAdmin();
  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return materials
      .filter((material) =>
        `${material.name} ${material.rack_location ?? ""}`.toLocaleLowerCase().includes(term),
      )
      .sort((a, b) =>
        (a.rack_location ?? "Unassigned").localeCompare(b.rack_location ?? "Unassigned", undefined, {
          numeric: true,
          sensitivity: "base",
        }) || a.name.localeCompare(b.name),
      );
  }, [materials, search]);

  const assignedCount = materials.filter((material) => material.rack_location?.trim()).length;
  const unassignedCount = materials.length - assignedCount;

  return (
    <AppShell>
      <section className="rise grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-marigold p-3.5 text-ink">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/70">
            Locations assigned
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{assignedCount}</div>
          <div className="mt-1 font-mono text-[10px] text-ink/70">of {materials.length} materials</div>
        </div>
        <div className="rounded-2xl bg-cobalt p-3.5 text-paper">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
            No rack set
          </div>
          <div className="mt-1.5 font-display text-[30px] leading-none">{unassignedCount}</div>
          <div className="mt-1 font-mono text-[10px] text-paper/70">materials to locate</div>
        </div>
      </section>

      <Panel title="Rack storage" hint={`${filteredMaterials.length} materials`} hintTone="cobalt">
        <div className="mt-3 flex justify-center">
          <label className="w-full max-w-md rounded-xl bg-background px-3 py-2 ring-1 ring-cobalt/40">
            <span className="sr-only">Search material or rack</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search material or rack location"
              aria-label="Search material or rack location"
              className="w-full bg-transparent text-center text-[13px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-quiet"
            />
          </label>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-black/5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
            <span>Material</span>
            <span className="text-right">Rack</span>
            <span className="text-right">Stock kg</span>
          </div>
          {filteredMaterials.length === 0 ? (
            <div className="bg-card px-3 py-5 text-center text-[12px] font-semibold text-quiet">
              {materials.length === 0
                ? "No materials have been added yet."
                : "No materials match this search."}
            </div>
          ) : (
            filteredMaterials.map((material, index) => {
              const low =
                Number(material.reorder_kg) > 0 &&
                Number(material.stock_kg) < Number(material.reorder_kg);
              return (
                <div
                  key={material.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-[12px] ${
                    low ? "bg-tomato/10" : index % 2 === 0 ? "bg-background" : "bg-card"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                    {low ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tomato" /> : null}
                    {material.name}
                  </span>
                  <span className="max-w-32 truncate text-right font-mono text-[10px] font-semibold">
                    {material.rack_location?.trim() || "Unassigned"}
                  </span>
                  <span className={`min-w-12 text-right font-mono font-semibold ${low ? "text-tomato" : ""}`}>
                    {num(material.stock_kg)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {isAdmin ? (
            <Button asChild variant="unstyled" size="compact" className="bg-cobalt font-mono uppercase text-paper">
              <Link to="/stock">Manage rack locations</Link>
            </Button>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}