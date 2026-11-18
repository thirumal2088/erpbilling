CREATE OR REPLACE FUNCTION public.apply_purchase()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.total_amount := ROUND(NEW.qty_kg * NEW.rate_per_kg, 2);
  UPDATE public.materials
     SET stock_kg = stock_kg + NEW.qty_kg,
         last_rate_per_kg = NEW.rate_per_kg
   WHERE id = NEW.material_id;
  RETURN NEW;
END;
$$;

UPDATE public.materials m
   SET stock_kg = m.stock_kg + x.q,
       last_rate_per_kg = CASE WHEN m.last_rate_per_kg = 0 THEN x.r ELSE m.last_rate_per_kg END
  FROM (SELECT p.material_id, SUM(p.qty_kg) q,
               (array_agg(p.rate_per_kg ORDER BY p.created_at DESC))[1] r
          FROM public.purchases p JOIN public.materials mm ON mm.id = p.material_id
         WHERE p.user_id <> mm.user_id GROUP BY p.material_id) x
 WHERE x.material_id = m.id;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS design_notes text,
  ADD COLUMN IF NOT EXISTS voice_note_path text,
  ADD COLUMN IF NOT EXISTS attachment_path text;

CREATE POLICY "bill files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'bill-files');
CREATE POLICY "bill files upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bill-files');