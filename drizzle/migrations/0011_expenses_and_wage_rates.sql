CREATE TABLE public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null default 'other',
  note text,
  amount numeric not null default 0,
  created_at timestamp with time zone not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses readable by all signed in" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signed in update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins delete expenses" ON public.expenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
ALTER TABLE public.workers ADD COLUMN rate_per_piece numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.workers.rate_per_piece IS 'Wage rate per finished piece, used for wage totals on reports';
