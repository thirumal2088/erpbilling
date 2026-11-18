CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE gross numeric; tp numeric; names text;
BEGIN
  IF NEW.gst_type <> 'direct' AND (NEW.invoice_no IS NULL OR NEW.invoice_no = '') THEN
    NEW.invoice_no := public.next_invoice_no(COALESCE(NEW.created_at, now()));
  END IF;
  IF NEW.gst_type = 'direct' THEN
    NEW.invoice_no := NULL;
  END IF;
  IF jsonb_typeof(NEW.line_items) = 'array' AND jsonb_array_length(NEW.line_items) > 0 THEN
    SELECT COALESCE(SUM(ROUND((e->>'pieces')::numeric * (e->>'rate')::numeric, 2)),0),
           COALESCE(SUM((e->>'pieces')::numeric),0),
           string_agg(e->>'item', ', ')
      INTO gross, tp, names
      FROM jsonb_array_elements(NEW.line_items) e;
    NEW.pieces := tp::int;
    NEW.item := LEFT(COALESCE(names,''), 300);
    NEW.rate_per_piece := CASE WHEN tp > 0 THEN ROUND(gross / tp, 2) ELSE 0 END;
  ELSE
    gross := ROUND(NEW.pieces * NEW.rate_per_piece, 2);
  END IF;
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
$function$;