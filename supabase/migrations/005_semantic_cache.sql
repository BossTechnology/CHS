-- 005_semantic_cache.sql
-- Semantic cache for chassis results using pgvector.
-- Stores OpenAI text-embedding-3-small embeddings (1536 dims) of normalized
-- business inputs so near-duplicate requests can be served from cache instead
-- of hitting the Anthropic API.
--
-- Cache hit criteria: cosine_distance(query_vec, cached_vec) < 0.07
-- (i.e. cosine_similarity > 0.93 — very similar inputs, same tier + lang)

BEGIN;

-- Enable pgvector (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Cache table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chassis_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text   TEXT        NOT NULL,
  tier_id      TEXT        NOT NULL,
  lang         TEXT        NOT NULL DEFAULT 'EN',
  embedding    vector(1536) NOT NULL,
  chassis_data JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count    INT         NOT NULL DEFAULT 0,
  last_hit_at  TIMESTAMPTZ
);

-- IVFFlat index for fast approximate nearest-neighbour search.
-- lists = sqrt(expected_rows). Start with 10; rebuild when row count grows.
CREATE INDEX IF NOT EXISTS chassis_cache_embedding_idx
  ON public.chassis_cache
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Composite index for pre-filtering by tier + lang before the vector search
CREATE INDEX IF NOT EXISTS chassis_cache_tier_lang_idx
  ON public.chassis_cache (tier_id, lang);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.chassis_cache ENABLE ROW LEVEL SECURITY;

-- Only the service role (server-side) reads/writes the cache.
-- Authenticated users have no direct access.
-- (The API Edge Function uses the service key.)
-- No GRANT to authenticated role intentionally.

-- ── Helper RPC: lookup_cache ──────────────────────────────────────────────
-- Called by the Edge Function with the service key.
-- Returns the best match within the similarity threshold, or nothing.
CREATE OR REPLACE FUNCTION public.lookup_chassis_cache(
  p_embedding  vector(1536),
  p_tier_id    TEXT,
  p_lang       TEXT,
  p_threshold  FLOAT DEFAULT 0.07  -- cosine_distance threshold (< = similar)
)
RETURNS TABLE (
  id           UUID,
  chassis_data JSONB,
  hit_count    INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, chassis_data, hit_count
  FROM public.chassis_cache
  WHERE tier_id = p_tier_id
    AND lang    = p_lang
  ORDER BY embedding <=> p_embedding
  LIMIT 1
$$;
-- Note: the distance filter is applied in application code after getting the
-- top-1 result, because IVFFlat indexes don't support WHERE on the distance.

-- ── Helper RPC: record_cache_hit ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_cache_hit(p_cache_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chassis_cache
  SET hit_count  = hit_count + 1,
      last_hit_at = NOW()
  WHERE id = p_cache_id;
$$;

-- ── Helper RPC: insert_chassis_cache ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_chassis_cache(
  p_input_text  TEXT,
  p_tier_id     TEXT,
  p_lang        TEXT,
  p_embedding   vector(1536),
  p_chassis_data JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.chassis_cache (input_text, tier_id, lang, embedding, chassis_data)
  VALUES (p_input_text, p_tier_id, p_lang, p_embedding, p_chassis_data)
  ON CONFLICT DO NOTHING
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.lookup_chassis_cache(vector, TEXT, TEXT, FLOAT)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_cache_hit(UUID)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_chassis_cache(TEXT, TEXT, TEXT, vector, JSONB) FROM PUBLIC;

COMMIT;
