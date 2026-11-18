ALTER TABLE public.sales ADD COLUMN payment_mode text NOT NULL DEFAULT 'credit';
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_mode_check CHECK (payment_mode IN ('cash','upi','credit'));
COMMENT ON COLUMN public.sales.payment_mode IS 'cash = paid by cash, upi = paid by UPI, credit = unpaid / payable later';