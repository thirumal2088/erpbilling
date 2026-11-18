import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { shortMoney } from "@/lib/format";
import { useIsAdmin } from "@/hooks/use-admin";

const NAV = [
  { to: "/dashboard", label: "Dashboard", accent: "bg-paper text-ink" },
  { to: "/purchase", label: "Purchase", accent: "bg-marigold text-ink" },
  { to: "/sales", label: "Billing", accent: "bg-leaf text-paper" },
  { to: "/stock", label: "Stock", accent: "bg-cobalt text-paper" },
  { to: "/rack", label: "Rack", accent: "bg-marigold text-ink" },
  { to: "/workers", label: "Workers", accent: "bg-plum text-paper" },
  { to: "/reports", label: "Reports", accent: "bg-tomato text-paper" },
] as const;

function todayLabel() {
  return new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();

  const { data: profile } = useQuery({
    queryKey: ["profile-header"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("unit_name, city")
        .eq("id", auth.user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payable = 0 } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("total_amount")
        .eq("paid", false);
      if (error) throw error;
      return (data ?? []).reduce((sum, r) => sum + Number(r.total_amount), 0);
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-ink px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] uppercase tracking-[0.14em] text-paper">
              {profile?.unit_name ?? "Garments Unit"}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-quiet">
              {isAdmin ? "ADMIN" : "STAFF"} · {todayLabel()}
              {profile?.city ? ` · ${profile.city.toUpperCase()}` : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-tomato px-3 py-1.5 font-mono text-[10px] font-semibold text-paper">
              {shortMoney(payable)} OPEN
            </span>
            <button
              onClick={signOut}
              className="rounded-full bg-paper/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase text-paper/70 transition-colors hover:bg-paper/20"
            >
              Exit
            </button>
          </div>
        </div>
        <nav className="mt-3 flex gap-1.5 overflow-x-auto text-[10px] font-semibold uppercase tracking-wider">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="shrink-0 rounded-full bg-paper/10 px-3 py-1.5 text-paper/60 transition-colors hover:bg-paper/20"
              activeProps={{
                className: `shrink-0 rounded-full px-3 py-1.5 shadow-[0_2px_0_0_rgba(0,0,0,0.25)] ${item.accent}`,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="space-y-4 p-3 pb-10">{children}</main>

      <div className="pb-6 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-quiet">
        kg in · pcs out
      </div>
    </div>
  );
}

export function Panel({
  title,
  hint,
  hintTone = "quiet",
  children,
  delay = 0,
}: {
  title: string;
  hint?: string;
  hintTone?: "quiet" | "cobalt" | "leaf" | "tomato";
  children: ReactNode;
  delay?: number;
}) {
  const tone = {
    quiet: "text-quiet",
    cobalt: "text-cobalt",
    leaf: "text-leaf",
    tomato: "text-tomato",
  }[hintTone];

  return (
    <section
      className="rise rounded-2xl bg-card p-4 ring-1 ring-black/5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg uppercase tracking-wide">{title}</h2>
        {hint ? (
          <span className={`font-mono text-[9px] uppercase tracking-widest ${tone}`}>{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-widest text-quiet">{children}</span>
  );
}

export function FieldBox({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block rounded-xl bg-background px-3 py-2 ring-1 ring-black/5 ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full bg-transparent text-[13px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-quiet";
