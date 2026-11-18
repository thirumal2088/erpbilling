-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL DEFAULT 'My Garments Unit',
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, unit_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'unit_name', 'My Garments Unit'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MATERIALS (stock in kg)
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  stock_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_rate_per_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own materials" ON public.materials FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PURCHASES (kg x rate/kg)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  supplier TEXT NOT NULL,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  qty_kg NUMERIC(12,2) NOT NULL CHECK (qty_kg > 0),
  rate_per_kg NUMERIC(12,2) NOT NULL CHECK (rate_per_kg >= 0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases" ON public.purchases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.total_amount := ROUND(NEW.qty_kg * NEW.rate_per_kg, 2);
  UPDATE public.materials
     SET stock_kg = stock_kg + NEW.qty_kg,
         last_rate_per_kg = NEW.rate_per_kg
   WHERE id = NEW.material_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_purchase BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase();

-- SALES (pieces x rate/piece)
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  customer TEXT NOT NULL,
  item TEXT NOT NULL,
  pieces INTEGER NOT NULL CHECK (pieces > 0),
  rate_per_piece NUMERIC(12,2) NOT NULL CHECK (rate_per_piece >= 0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.total_amount := ROUND(NEW.pieces * NEW.rate_per_piece, 2);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_sale BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.apply_sale();

-- WORKERS
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'cutting' CHECK (stage IN ('cutting','stitching','finishing','packing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workers" ON public.workers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WORK JOBS (workflow)
CREATE TABLE public.work_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  job_no TEXT NOT NULL,
  item TEXT NOT NULL,
  pieces INTEGER NOT NULL CHECK (pieces > 0),
  stage TEXT NOT NULL DEFAULT 'cutting' CHECK (stage IN ('cutting','stitching','finishing','packing','done')),
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_jobs TO authenticated;
GRANT ALL ON public.work_jobs TO service_role;
ALTER TABLE public.work_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own work jobs" ON public.work_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_purchases_user ON public.purchases(user_id, created_at DESC);
CREATE INDEX idx_sales_user ON public.sales(user_id, created_at DESC);
CREATE INDEX idx_jobs_user ON public.work_jobs(user_id, stage);