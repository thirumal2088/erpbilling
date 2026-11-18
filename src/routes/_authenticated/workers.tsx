import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, FieldBox, Panel, inputClass } from "@/components/AppShell";
import { num, shortMoney, STAGES, STAGE_LABEL, type Stage } from "@/lib/format";
import { useIsAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/workers")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Worker workflow — RAINBOW ERP" },
      {
        name: "description",
        content:
          "Follow every job through cutting, stitching, finishing and packing, with the worker in charge and the piece count at each stage.",
      },
      { property: "og:title", content: "Worker workflow — RAINBOW ERP" },
      {
        property: "og:description",
        content: "Cutting to packing: who holds each job and how many pieces are at each stage.",
      },
    ],
  }),
  component: WorkersPage,
});

const STAGE_BG: Record<string, string> = {
  cutting: "bg-plum text-paper",
  stitching: "bg-cobalt text-paper",
  finishing: "bg-marigold text-ink",
  packing: "bg-leaf text-paper",
};

function nextStage(stage: string): string {
  const i = STAGES.indexOf(stage as Stage);
  if (i === -1 || i === STAGES.length - 1) return "done";
  return STAGES[i + 1] as string;
}

type JobRow = {
  id: string;
  job_no: string;
  item: string;
  pieces: number;
  stage: string;
  worker_id: string | null;
  sale_id: string | null;
  workers: { name: string } | null;
};

type JobEvent = {
  id: string;
  job_id: string;
  stage: string;
  created_at: string;
  workers: { name: string } | null;
};

function WorkersPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [workerName, setWorkerName] = useState("");
  const [workerRate, setWorkerRate] = useState("");
  const [workerStage, setWorkerStage] = useState<string>("cutting");
  const [saleId, setSaleId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [advanceJobId, setAdvanceJobId] = useState("");
  const [advanceWorkerId, setAdvanceWorkerId] = useState("");
  const [historyJobId, setHistoryJobId] = useState("");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
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
      return data as unknown as JobRow[];
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, customer, item, pieces")
        .not("invoice_no", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["work_job_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_job_events")
        .select("id, job_id, stage, created_at, workers(name)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as JobEvent[];
    },
  });

  const addWorker = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workers").insert({
        name: workerName.trim(),
        stage: workerStage,
        rate_per_piece: Number(workerRate) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Worker added");
      setWorkerName("");
      setWorkerRate("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("workers")
        .update({ rate_per_piece: rate })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wage rate saved");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addJob = useMutation({
    mutationFn: async () => {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) throw new Error("Pick an invoice first");
      const { error } = await supabase.from("work_jobs").insert({
        job_no: sale.invoice_no ?? "",
        sale_id: sale.id,
        item: sale.item,
        pieces: sale.pieces,
        worker_id: assignee || null,
        stage: "cutting",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job added to cutting");
      setSaleId("");
      setAssignee("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveJob = useMutation({
    mutationFn: async ({ id, stage, workerId }: { id: string; stage: string; workerId: string }) => {
      const { error } = await supabase
        .from("work_jobs")
        .update({
          stage,
          worker_id: stage === "done" ? null : workerId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.stage === "done" ? "Job dispatched" : `Moved to ${STAGE_LABEL[v.stage]}`);
      setAdvanceJobId("");
      setAdvanceWorkerId("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wip = jobs.filter((j) => j.stage !== "done");
  const assignedSaleIds = new Set(jobs.map((j) => j.sale_id).filter(Boolean));
  const openSales = sales.filter((s) => !assignedSaleIds.has(s.id));
  const advancingJob = wip.find((j) => j.id === advanceJobId);
  const advancingNext = advancingJob ? nextStage(advancingJob.stage) : "";
  const stageWorkers = workers.filter((w) => w.stage === advancingNext);
  const pcsByWorker = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (!j.worker_id) continue;
      m.set(j.worker_id, (m.get(j.worker_id) ?? 0) + Number(j.pieces));
    }
    return m;
  }, [jobs]);
  const wagesTotal = workers.reduce(
    (sum, w) => sum + (pcsByWorker.get(w.id) ?? 0) * Number(w.rate_per_piece ?? 0),
    0,
  );

  return (
    <AppShell>
      <Panel title="Worker stages" hint="pcs">
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {STAGES.map((stage, i) => {
            const stageJobs = wip.filter((j) => j.stage === stage);
            const stagePieces = stageJobs.reduce((s, j) => s + Number(j.pieces), 0);
            const names = Array.from(
              new Set(
                stageJobs
                  .map((j) => j.workers?.name)
                  .filter(Boolean) as string[],
              ),
            );
            return (
              <div
                key={stage}
                className={`slide-x w-32 shrink-0 rounded-xl p-3 ${STAGE_BG[stage]}`}
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-70">
                  {STAGE_LABEL[stage]}
                </div>
                <div className="mt-1 font-display text-[24px] leading-none">{num(stagePieces)}</div>
                <div className="mt-1 truncate font-mono text-[9px] opacity-70">
                  {names[0] ?? "Unassigned"} · {stageJobs.length} jobs
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Jobs on floor" hint="assign step by step" hintTone="cobalt" delay={70}>
        <div className="mt-2.5 space-y-1.5">
          {wip.length === 0 ? (
            <div className="rounded-xl bg-background px-3 py-4 text-center text-[12px] text-quiet ring-1 ring-black/5">
              No jobs running. Add one below.
            </div>
          ) : (
            wip.map((j) => {
              const jobEvents = events.filter((e) => e.job_id === j.id);
              const isAdvancing = advanceJobId === j.id;
              const isHistory = historyJobId === j.id;
              const next = nextStage(j.stage);
              return (
                <div key={j.id} className="rounded-xl bg-background ring-1 ring-black/5">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">
                        {j.job_no} · {j.item}
                      </div>
                      <div className="truncate font-mono text-[10px] text-quiet">
                        {num(j.pieces)} pcs · {j.workers?.name ?? "Unassigned"} ·{" "}
                        {STAGE_LABEL[j.stage]}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => setHistoryJobId(isHistory ? "" : j.id)}
                        className="rounded-lg bg-card px-2.5 py-2 font-mono text-[9px] uppercase tracking-widest text-ink ring-1 ring-black/10"
                      >
                        Steps
                      </button>
                      <button
                        onClick={() => {
                          setAdvanceJobId(isAdvancing ? "" : j.id);
                          setAdvanceWorkerId("");
                        }}
                        className={`rounded-lg px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-paper ${
                          next === "done" ? "bg-leaf" : "bg-ink"
                        }`}
                      >
                        {next === "done" ? "Dispatch" : `→ ${STAGE_LABEL[next]}`}
                      </button>
                    </div>
                  </div>

                  {isAdvancing && next !== "done" && (
                    <div className="border-t border-dashed border-black/10 px-3 py-2.5">
                      <FieldBox label={`Who takes ${STAGE_LABEL[next]}?`}>
                        <select
                          className={inputClass}
                          value={advanceWorkerId}
                          onChange={(e) => setAdvanceWorkerId(e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {stageWorkers.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                          {stageWorkers.length === 0 &&
                            workers
                              .filter((w) => w.stage !== advancingNext)
                              .map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} ({STAGE_LABEL[w.stage]})
                                </option>
                              ))}
                        </select>
                      </FieldBox>
                      <button
                        disabled={moveJob.isPending}
                        onClick={() =>
                          moveJob.mutate({ id: j.id, stage: next, workerId: advanceWorkerId })
                        }
                        className="mt-2 w-full rounded-xl bg-cobalt py-2.5 font-display text-[12px] uppercase tracking-widest text-paper disabled:opacity-50"
                      >
                        Assign & move to {STAGE_LABEL[next]}
                      </button>
                    </div>
                  )}

                  {isAdvancing && next === "done" && (
                    <div className="border-t border-dashed border-black/10 px-3 py-2.5">
                      <p className="text-[11px] text-quiet">
                        Dispatch this job? It leaves the floor and the packing worker hands it over.
                      </p>
                      <button
                        disabled={moveJob.isPending}
                        onClick={() => moveJob.mutate({ id: j.id, stage: "done", workerId: "" })}
                        className="mt-2 w-full rounded-xl bg-leaf py-2.5 font-display text-[12px] uppercase tracking-widest text-paper disabled:opacity-50"
                      >
                        Confirm dispatch
                      </button>
                    </div>
                  )}

                  {isHistory && (
                    <div className="border-t border-dashed border-black/10 px-3 py-2">
                      {jobEvents.length === 0 ? (
                        <p className="py-1 font-mono text-[10px] text-quiet">No steps recorded yet.</p>
                      ) : (
                        <ol className="space-y-1 py-1">
                          {jobEvents.map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center justify-between font-mono text-[10px]"
                            >
                              <span>
                                <span className="font-semibold uppercase">{STAGE_LABEL[e.stage] ?? e.stage}</span>
                                {" · "}
                                {e.workers?.name ?? "Unassigned"}
                              </span>
                              <span className="text-quiet">
                                {new Date(e.created_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <Panel title="New job" hint="starts at cutting" delay={140}>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FieldBox label="Invoice no." className="col-span-2">
            <select
              className={inputClass}
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
            >
              <option value="">Select an invoice</option>
              {openSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.invoice_no} · {s.customer} · {s.item} ({num(s.pieces)} pcs)
                </option>
              ))}
            </select>
          </FieldBox>
          <FieldBox label="Cutting worker" className="col-span-2">
            <select
              className={inputClass}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {workers
                .filter((w) => w.stage === "cutting")
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </FieldBox>
        </div>
        <button
          disabled={!saleId || addJob.isPending}
          onClick={() => addJob.mutate()}
          className="mt-2.5 w-full rounded-xl bg-plum py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-50"
        >
          Add job
        </button>
      </Panel>

      <Panel title="Workers" hint={`wages ${shortMoney(wagesTotal)}`} delay={210}>
        <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-black/5">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-paper/70">
            <span>Name</span>
            <span className="text-right">Pcs</span>
            <span className="text-right">Rate/pc</span>
            <span className="text-right">Wage</span>
          </div>
          {workers.length === 0 ? (
            <div className="bg-card px-3 py-4 text-center text-[12px] text-quiet">
              No workers on roll yet.
            </div>
          ) : (
            workers.map((w, i) => {
              const pcs = pcsByWorker.get(w.id) ?? 0;
              return (
                <div
                  key={w.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 text-[12px] ${
                    i % 2 === 0 ? "bg-background" : "bg-card"
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">
                    {w.name}
                    <span className="ml-1 font-mono text-[9px] text-quiet">
                      {STAGE_LABEL[w.stage]}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-quiet">{pcs}</span>
                  {isAdmin ? (
                    <input
                      key={`${w.id}-${w.rate_per_piece}`}
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={Number(w.rate_per_piece ?? 0)}
                      onBlur={(e) => {
                        const rate = Number(e.target.value) || 0;
                        if (rate !== Number(w.rate_per_piece ?? 0))
                          updateRate.mutate({ id: w.id, rate });
                      }}
                      className="w-14 rounded-md bg-card px-1.5 py-1 text-right font-mono text-[11px] font-semibold text-foreground ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-cobalt"
                    />
                  ) : (
                    <span className="font-mono text-[11px] text-quiet">
                      {Number(w.rate_per_piece ?? 0).toFixed(2)}
                    </span>
                  )}
                  <span className="w-14 text-right font-mono text-[11px] font-semibold">
                    {shortMoney(pcs * Number(w.rate_per_piece ?? 0))}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {!isAdmin ? (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-quiet">
            View only · ask an admin to add workers
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <FieldBox label="Worker name">
                <input
                  className={inputClass}
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="Sushila"
                />
              </FieldBox>
              <FieldBox label="Station">
                <select
                  className={inputClass}
                  value={workerStage}
                  onChange={(e) => setWorkerStage(e.target.value)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </FieldBox>
              <FieldBox label="Rs./pc">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputClass}
                  value={workerRate}
                  onChange={(e) => setWorkerRate(e.target.value)}
                  placeholder="0"
                />
              </FieldBox>
            </div>
            <button
              disabled={!workerName.trim() || addWorker.isPending}
              onClick={() => addWorker.mutate()}
              className="mt-2.5 w-full rounded-xl bg-ink py-3 text-center font-display text-sm uppercase tracking-widest text-paper disabled:opacity-50"
            >
              Add worker
            </button>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
