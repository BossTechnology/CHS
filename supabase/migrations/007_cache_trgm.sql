-- 007_cache_trgm.sql
-- Replace pgvector semantic cache with pg_trgm text-similarity cache.
-- No external API required. similarity() threshold 0.65 catches near-identical
-- business descriptions (typos, word order, abbreviations, extra commas).
-- Applied to production 2026-04-27.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop the vector column and its index — no longer needed
DROP INDEX IF EXISTS public.chassis_cache_embedding_idx;
ALTER TABLE public.chassis_cache DROP COLUMN IF EXISTS embedding;

-- GIN trigram index on input_text for fast similarity search
CREATE INDEX IF NOT EXISTS chassis_cache_trgm_idx
  ON public.chassis_cache
  USING gin (input_text gin_trgm_ops);

-- ── Replace lookup_chassis_cache ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.lookup_chassis_cache(vector, TEXT, TEXT, FLOAT);

CREATE OR REPLACE FUNCTION public.lookup_chassis_cache(
  p_input_text TEXT,
  p_tier_id    TEXT,
  p_lang       TEXT,
  p_threshold  FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id           UUID,
  chassis_data JSONB,
  hit_count    INT,
  sim          FLOAT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, chassis_data, hit_count,
         similarity(input_text, p_input_text) AS sim
  FROM public.chassis_cache
  WHERE tier_id = p_tier_id
    AND lang    = p_lang
    AND similarity(input_text, p_input_text) > p_threshold
  ORDER BY similarity(input_text, p_input_text) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_chassis_cache(TEXT, TEXT, TEXT, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_chassis_cache(TEXT, TEXT, TEXT, FLOAT) TO authenticated;

-- ── Replace insert_chassis_cache ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.insert_chassis_cache(TEXT, TEXT, TEXT, vector, JSONB);

CREATE OR REPLACE FUNCTION public.insert_chassis_cache(
  p_input_text   TEXT,
  p_tier_id      TEXT,
  p_lang         TEXT,
  p_chassis_data JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.chassis_cache (input_text, tier_id, lang, chassis_data)
  VALUES (p_input_text, p_tier_id, p_lang, p_chassis_data)
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.insert_chassis_cache(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_chassis_cache(TEXT, TEXT, TEXT, JSONB) TO authenticated;
