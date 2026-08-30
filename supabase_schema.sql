-- Create reports table for VERDICT
CREATE TABLE public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    url TEXT NOT NULL,
    fdi_buzzword_density INTEGER NOT NULL,
    fdi_trust_deficit INTEGER NOT NULL,
    fdi_gatekeeping_friction INTEGER NOT NULL,
    fdi_feature_ratio INTEGER NOT NULL,
    fdi_overall_score INTEGER NOT NULL,
    verdict_value_prop TEXT NOT NULL,
    verdict_evidence_deficit TEXT NOT NULL,
    verdict_revenue_viability TEXT NOT NULL,
    verdict_distribution_moat TEXT NOT NULL,
    verdict_intent_friction TEXT NOT NULL,
    verdict_competitive_overlap TEXT NOT NULL,
    verdict_terminal_risk TEXT NOT NULL,
    executive_summary TEXT NOT NULL,
    first_impression_teardown TEXT NOT NULL,
    top_5_priorities JSONB NOT NULL,
    key_risks JSONB NOT NULL,
    growth_plan_30_day JSONB NOT NULL,
    evidence_trace JSONB NULL,
    audit_context JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reports (since they are shared via UUID)
CREATE POLICY "Allow public read access to reports"
    ON public.reports
    FOR SELECT
    USING (true);

-- Note: Insert access is handled via the backend API using the SUPABASE_SERVICE_ROLE_KEY,
-- which automatically bypasses RLS. Therefore, no public insert policy is needed.

-- Create used_transactions table for preventing double-spends in the A2MCP hybrid interceptor
CREATE TABLE public.used_transactions (
    tx_hash TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.used_transactions ENABLE ROW LEVEL SECURITY;

-- Note: No public policies needed. Insert/Select handled securely by backend API using SUPABASE_SERVICE_ROLE_KEY.
