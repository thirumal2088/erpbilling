-- Shop details for printed bills
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Invoice fields on sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS gst_type TEXT NOT NULL DEFAULT 'non_gst',
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_gst_type_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_gst_type_check CHECK (gst_type IN ('gst','non_gst'));
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_gst_rate_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_gst_rate_check CHECK (gst_rate IN (0,5,12));

-- Invoice number counters (financial year based)
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  fy TEXT PRIMARY KEY,
  last_no INTEGER NOT NULL DEFAULT 0
);
GRANT ALL ON public.invoice_counters TO service_role;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_invoice_no(_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM _at);
  m INT := EXTRACT(MONTH FROM _at);
  start_y INT;
  fy_label TEXT;
  n INT;
BEGIN
  start_y := CASE WHEN m >= 4 THEN y ELSE y - 1 END;
  fy_label := lpad((start_y % 100)::text, 2, '0') || lpad(((start_y + 1) % 100)::text, 2, '0');

  INSERT INTO public.invoice_counters(fy, last_no) VALUES (fy_label, 1)
  ON CONFLICT (fy) DO UPDATE SET last_no = public.invoice_counters.last_no + 1
  RETURNING last_no INTO n;

  RETURN 'INV-' || fy_label || '-' || lpad(n::text, 4, '0');
END;
$$;

-- Recompute sale totals with GST
CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := public.next_invoice_no(COALESCE(NEW.created_at, now()));
  END IF;

  NEW.subtotal := ROUND(NEW.pieces * NEW.rate_per_piece, 2);

  IF NEW.gst_type = 'gst' THEN
    NEW.tax_amount := ROUND(NEW.subtotal * NEW.gst_rate / 100.0, 2);
  ELSE
    NEW.gst_rate := 0;
    NEW.tax_amount := 0;
  END IF;

  NEW.total_amount := NEW.subtotal + NEW.tax_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_sale_trg ON public.sales;
DROP TRIGGER IF EXISTS sales_apply_sale ON public.sales;
CREATE TRIGGER apply_sale_trg
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_sale();

-- Backfill existing rows
UPDATE public.sales
SET subtotal = total_amount
WHERE subtotal = 0 AND total_amount > 0;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM public.sales WHERE invoice_no IS NULL ORDER BY created_at LOOP
    UPDATE public.sales SET invoice_no = public.next_invoice_no(r.created_at) WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice_no_key ON public.sales(invoice_no);

-- Jobs are assigned against an invoice
ALTER TABLE public.work_jobs
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;
