-- Apply once to existing Verdict deployments before deploying Phase 3C.
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS evidence_trace JSONB;
