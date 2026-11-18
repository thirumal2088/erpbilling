import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { FieldLabel, inputClass } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Sign in to your garment unit's billing book: kilo purchases, piece sales, material stock and the worker job board.",
      },
      { property: "og:title", content: "Sign in — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Access your unit's purchases, sales, stock and worker workflow.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitName, setUnitName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { unit_name: unitName || "My Garments Unit" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink px-4 py-5">
        <div className="font-display text-[15px] uppercase tracking-[0.14em] text-paper">
          RAINBOW ERP
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-quiet">KG IN · PCS OUT</div>
      </header>

      <main className="p-3">
        <section className="rise mx-auto mt-4 max-w-md rounded-2xl bg-card p-4 ring-1 ring-black/5">
          <h1 className="font-display text-xl uppercase tracking-wide">
            {mode === "signin" ? "Open your book" : "Start your book"}
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-quiet">
            Purchases · Sales · Stock · Workers
          </p>

          {sent ? (
            <p className="mt-4 rounded-xl bg-background px-3 py-3 text-[13px] ring-1 ring-black/5">
              Check your email and tap the confirmation link, then come back and sign in.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-2">
              {mode === "signup" ? (
                <label className="block rounded-xl bg-background px-3 py-2 ring-1 ring-black/5">
                  <FieldLabel>Unit name</FieldLabel>
                  <input
                    className={inputClass}
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="Sundari Garments"
                  />
                </label>
              ) : null}
              <label className="block rounded-xl bg-background px-3 py-2 ring-1 ring-black/5">
                <FieldLabel>Email</FieldLabel>
                <input
                  className={inputClass}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@unit.com"
                />
              </label>
              <label className="block rounded-xl bg-background px-3 py-2 ring-1 ring-black/5">
                <FieldLabel>Password</FieldLabel>
                <input
                  className={inputClass}
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-xl bg-cobalt py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-60"
              >
                {busy ? "Please wait" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          )}

          <button
            onClick={google}
            className="mt-2 w-full rounded-xl bg-background py-3 text-center text-[13px] font-semibold ring-1 ring-black/10"
          >
            Continue with Google
          </button>

          <button
            onClick={() => {
              setSent(false);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="mt-3 w-full font-mono text-[10px] uppercase tracking-widest text-quiet"
          >
            {mode === "signin" ? "New unit? Create an account" : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    </div>
  );
}
