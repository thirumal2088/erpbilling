-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Existing users become admins; first user of an empty project is admin, later signups are staff
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
      THEN 'staff'::public.app_role
      ELSE 'admin'::public.app_role END
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Shared materials: everyone signed in reads, only admins write
DROP POLICY IF EXISTS "own materials" ON public.materials;
CREATE POLICY "materials readable by all signed in" ON public.materials
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert materials" ON public.materials
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update materials" ON public.materials
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete materials" ON public.materials
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shared workers: everyone reads, only admins manage the roll
DROP POLICY IF EXISTS "own workers" ON public.workers;
CREATE POLICY "workers readable by all signed in" ON public.workers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert workers" ON public.workers
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update workers" ON public.workers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete workers" ON public.workers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shared work jobs: everyone reads and moves jobs, only admins delete
DROP POLICY IF EXISTS "own work jobs" ON public.work_jobs;
CREATE POLICY "jobs readable by all signed in" ON public.work_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in insert jobs" ON public.work_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signed in update jobs" ON public.work_jobs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins delete jobs" ON public.work_jobs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shared purchases and sales ledger reads
DROP POLICY IF EXISTS "own purchases" ON public.purchases;
CREATE POLICY "purchases readable by all signed in" ON public.purchases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in insert purchases" ON public.purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signed in update purchases" ON public.purchases
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins delete purchases" ON public.purchases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own sales" ON public.sales;
CREATE POLICY "sales readable by all signed in" ON public.sales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in insert sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signed in update sales" ON public.sales
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));