ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'none';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS offer_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD CONSTRAINT sales_offer_type_chk CHECK (offer_type IN ('none','percent','flat'));
ALTER TABLE public.sales ADD CONSTRAINT sales_offer_value_chk CHECK (offer_value >= 0);

CREATE OR REPLACE FUNCTION public.apply_sale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gross numeric;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := public.next_invoice_no(COALESCE(NEW.created_at, now()));
  END IF;
  gross := ROUND(NEW.pieces * NEW.rate_per_piece, 2);
  IF NEW.offer_type = 'percent' THEN
    NEW.discount_amount := ROUND(gross * LEAST(NEW.offer_value, 100) / 100.0, 2);
  ELSIF NEW.offer_type = 'flat' THEN
    NEW.discount_amount := LEAST(ROUND(NEW.offer_value, 2), gross);
  ELSE
    NEW.offer_value := 0;
    NEW.discount_amount := 0;
  END IF;
  NEW.subtotal := gross - NEW.discount_amount;
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