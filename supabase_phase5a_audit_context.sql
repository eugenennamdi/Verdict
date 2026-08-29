-- Phase 5A: compact semantic context for grounded audit intelligence.
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS audit_context JSONB;
