import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "RAINBOW ERP — Garments billing, stock in kg, sales by piece" },
      {
        name: "description",
        content:
          "Billing built for garment units: buy raw material by the kilo, sell finished pieces, keep material stock in kilos and track every job from cutting to packing.",
      },
      { property: "og:title", content: "RAINBOW ERP — Garments billing for kilo in, pieces out" },
      {
        property: "og:description",
        content:
          "Kilo purchases, piece invoices, live material stock and a worker workflow board in one book.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink px-4 py-5">
        <div className="font-display text-[15px] uppercase tracking-[0.14em] text-paper">
          RAINBOW ERP
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-quiet">KG IN · PCS OUT</div>
      </header>

      <main className="space-y-4 p-3 pb-10">
        <section className="rise rounded-2xl bg-card p-4 ring-1 ring-black/5">
          <h1 className="font-display text-[28px] uppercase leading-[1.05] tracking-wide">
            Buy by the kilo.
            <br />
            Sell by the piece.
          </h1>
          <p className="mt-2 text-[13px] text-quiet">
            One book for your unit: supplier purchases weighed in kilos, customer invoices counted
            in pieces, live material stock, and every job tracked from cutting to packing.
          </p>
          <Link
            to="/auth"
            className="mt-4 block w-full rounded-xl bg-cobalt py-3 text-center font-display text-sm uppercase tracking-widest text-paper"
          >
            Open your book
          </Link>
        </section>

        <section className="rise grid grid-cols-2 gap-2" style={{ animationDelay: "70ms" }}>
          <div className="rounded-2xl bg-cobalt p-3.5 text-paper">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
              Purchase
            </div>
            <div className="mt-1.5 font-display text-[26px] leading-none">KG × ₹</div>
            <div className="mt-1 font-mono text-[10px] text-paper/70">stock updates itself</div>
          </div>
          <div className="rounded-2xl bg-tomato p-3.5 text-paper">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
              Sales
            </div>
            <div className="mt-1.5 font-display text-[26px] leading-none">PCS × ₹</div>
            <div className="mt-1 font-mono text-[10px] text-paper/70">invoice total on entry</div>
          </div>
          <div className="rounded-2xl bg-marigold p-3.5 text-ink">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/70">
              Stock
            </div>
            <div className="mt-1.5 font-display text-[26px] leading-none">KG LIVE</div>
            <div className="mt-1 font-mono text-[10px] text-ink/70">low-stock flags</div>
          </div>
          <div className="rounded-2xl bg-plum p-3.5 text-paper">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
              Workers
            </div>
            <div className="mt-1.5 font-display text-[26px] leading-none">4 STAGES</div>
            <div className="mt-1 font-mono text-[10px] text-paper/70">cutting → packing</div>
          </div>
        </section>

        <div className="pt-1 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-quiet">
          RAINBOW ERP · kg in · pcs out
        </div>
      </main>
    </div>
  );
}
