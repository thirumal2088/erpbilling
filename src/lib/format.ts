const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${inr.format(Math.round(n))}`;
}

export function num(value: number | string | null | undefined): string {
  return inr2.format(Number(value ?? 0));
}

export function shortMoney(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

export const STAGES = ["cutting", "stitching", "finishing", "packing"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  cutting: "Cutting",
  stitching: "Stitching",
  finishing: "Finishing",
  packing: "Packing",
  done: "Dispatched",
};
