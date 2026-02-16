-- Security hardening for criteria and examples tables
-- These are read-only reference data; anon/authenticated should only SELECT.

-- 1. Tighten privileges: read-only for anon/authenticated
REVOKE ALL ON TABLE public.criteria FROM anon, authenticated;
REVOKE ALL ON TABLE public.examples FROM anon, authenticated;
GRANT SELECT ON TABLE public.criteria TO anon, authenticated;
GRANT SELECT ON TABLE public.examples TO anon, authenticated;

-- Remove sequence access (not needed for read-only roles)
REVOKE ALL ON SEQUENCE public.criteria_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.examples_id_seq FROM anon, authenticated;

-- 2. Add RLS policies for read-only public access
CREATE POLICY "Allow public read access on criteria"
  ON public.criteria FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access on examples"
  ON public.examples FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Force RLS even for table owner (defense in depth)
ALTER TABLE public.criteria FORCE ROW LEVEL SECURITY;
ALTER TABLE public.examples FORCE ROW LEVEL SECURITY;

-- 4. Index the foreign key for JOIN and CASCADE performance
CREATE INDEX IF NOT EXISTS idx_examples_criteria_id
  ON public.examples (criteria_id);
