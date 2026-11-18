import { z } from "zod";

const pricingSchema = z.object({
  finalAmount: z.number().finite().positive().max(1_000_000_000),
  gstRate: z.union([z.literal(0), z.literal(5), z.literal(12)]),
  offerType: z.enum(["none", "percent", "flat"]),
  offerValue: z.number().finite().nonnegative().max(1_000_000_000),
  items: z.array(z.object({
    pieces: z.number().finite().int().positive().max(1_000_000),
    rate: z.number().finite().nonnegative().max(1_000_000_000),
  })).min(1).max(1000),
});

/** The final amount includes GST and any offer; preserve relative item prices. */
export function pricesFromFinalAmount(input: z.input<typeof pricingSchema>): number[] {
  const data = pricingSchema.parse(input);
  if (data.offerType === "percent" && data.offerValue >= 100) {
    throw new Error("A 100% offer cannot have a positive final amount");
  }
  const taxable = data.finalAmount / (1 + data.gstRate / 100);
  const gross = data.offerType === "percent"
    ? taxable / (1 - data.offerValue / 100)
    : data.offerType === "flat" ? taxable + data.offerValue : taxable;
  const originalGross = data.items.reduce((sum, item) => sum + item.pieces * item.rate, 0);
  const pieces = data.items.reduce((sum, item) => sum + item.pieces, 0);
  return data.items.map((item) => {
    const rate = originalGross > 0 ? item.rate * gross / originalGross : gross / pieces;
    return z.number().finite().nonnegative().max(1_000_000_000).parse(Number(rate.toFixed(8)));
  });
}