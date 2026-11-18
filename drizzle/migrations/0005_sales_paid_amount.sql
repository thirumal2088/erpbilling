ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
UPDATE public.sales SET paid_amount = total_amount WHERE payment_mode IN ('cash','upi');