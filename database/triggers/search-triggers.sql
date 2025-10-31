-- Create the search_vector column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pastes' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE pastes ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Ensure column is tsvector type (only if it exists but wrong type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pastes'
    AND column_name = 'search_vector'
    AND data_type != 'tsvector'
  ) THEN
    ALTER TABLE pastes ALTER COLUMN search_vector TYPE tsvector
    USING to_tsvector('english', COALESCE(search_vector::text, ''));
  END IF;
END $$;

-- Create GIN index for full-text search (idempotent)
CREATE INDEX IF NOT EXISTS pastes_search_vector_idx
ON pastes USING gin(search_vector);

-- Create function to update search vector (idempotent with OR REPLACE)
CREATE OR REPLACE FUNCTION update_paste_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.id, '') || ' ' ||
    COALESCE(NEW.custom_slug, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (idempotent)
DROP TRIGGER IF EXISTS paste_search_vector_update ON pastes;
CREATE TRIGGER paste_search_vector_update
  BEFORE INSERT OR UPDATE ON pastes
  FOR EACH ROW EXECUTE FUNCTION update_paste_search_vector();

-- Update existing rows ONLY if search_vector is NULL
-- This only runs once per row, not on every server restart
UPDATE pastes
SET search_vector = to_tsvector('english',
    COALESCE(title, '') || ' ' ||
    COALESCE(content, '') || ' ' ||
    COALESCE(id, '') || ' ' ||
    COALESCE(custom_slug, '')
)
WHERE search_vector IS NULL;
