-- ─────────────────────────────────────────────────────────────────────────────
-- UMA ITSM — Sprint 5 Migration
-- Run AFTER sprint4.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── FULL-TEXT SEARCH VECTOR ───────────────────────────────────────────────────
-- Add tsvector column to tickets for fast full-text search and duplicate detection.
-- The trigger keeps it in sync with title + description.

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Trigger function: keep search_vector up to date on every INSERT/UPDATE
CREATE OR REPLACE FUNCTION fn_update_ticket_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_ticket_search_vector
    BEFORE INSERT OR UPDATE OF title, description ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION fn_update_ticket_search_vector();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_tickets_search_vector
  ON public.tickets USING GIN (search_vector);

-- Backfill existing tickets
UPDATE public.tickets
SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

-- ── DUPLICATE DETECTION FUNCTION ─────────────────────────────────────────────
-- Returns tickets similar to a given query in the same region.
-- Used by /api/ai/check-duplicates to surface potential duplicates before submission.

CREATE OR REPLACE FUNCTION fn_find_similar_tickets(
  query_text  TEXT,
  p_region_id UUID,
  max_results INT DEFAULT 5
)
RETURNS TABLE (
  ticket_id     UUID,
  ticket_number TEXT,
  title         TEXT,
  status        public.ticket_status,
  rank          FLOAT
) AS $$
DECLARE
  tsq tsquery;
BEGIN
  -- Build a tsquery from the input text (websearch_to_tsquery is more lenient)
  tsq := websearch_to_tsquery('english', query_text);

  -- If the query is empty / unsearchable, return nothing
  IF tsq IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.ticket_number,
    t.title,
    t.status,
    ts_rank_cd(t.search_vector, tsq)::FLOAT AS rank
  FROM public.tickets t
  WHERE
    t.region_id = p_region_id
    AND t.status NOT IN ('resolved', 'closed')
    AND t.search_vector @@ tsq
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── TICKET NUMBER INDEX ───────────────────────────────────────────────────────
-- Used by Global Search in admin panel
CREATE INDEX IF NOT EXISTS idx_tickets_number_text
  ON public.tickets (ticket_number);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS tickets_with_search_vector FROM public.tickets WHERE search_vector IS NOT NULL;
