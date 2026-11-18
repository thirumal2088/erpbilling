CREATE TABLE public.work_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.work_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.work_job_events TO authenticated;
GRANT ALL ON public.work_job_events TO service_role;

ALTER TABLE public.work_job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job events readable by all signed in"
  ON public.work_job_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "signed in insert job events"
  ON public.work_job_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_job_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage OR NEW.worker_id IS DISTINCT FROM OLD.worker_id THEN
    INSERT INTO public.work_job_events (job_id, stage, worker_id) VALUES (NEW.id, NEW.stage, NEW.worker_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_job_stage
  AFTER INSERT OR UPDATE ON public.work_jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_job_stage();