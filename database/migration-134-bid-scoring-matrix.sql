-- Migration 134: Bid Scoring Matrix
-- Adds configurable scoring criteria and weighted evaluation system

-- ============================================================
-- BID SCORING CRITERIA (per bid package)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_bid_scoring_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id UUID NOT NULL REFERENCES v2_bids(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL DEFAULT 10,  -- Weight out of 100
  max_score INTEGER NOT NULL DEFAULT 5,  -- Max points (typically 1-5 or 1-10)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bid_package_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bid_scoring_criteria_package ON v2_bid_scoring_criteria(bid_package_id);

-- ============================================================
-- BID EVALUATION SCORES (per submission per criterion)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_bid_evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES v2_subcontractor_bids(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES v2_bid_scoring_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,  -- Score (0 to max_score)
  notes TEXT,
  evaluated_by TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(submission_id, criteria_id)
);

CREATE INDEX IF NOT EXISTS idx_bid_evaluation_scores_submission ON v2_bid_evaluation_scores(submission_id);

-- ============================================================
-- DEFAULT SCORING CRITERIA TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_bid_scoring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  trade_category TEXT,
  criteria JSONB NOT NULL,  -- Array of {name, description, weight, max_score}
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert standard scoring template
INSERT INTO v2_bid_scoring_templates (name, trade_category, criteria, is_default)
VALUES (
  'Standard Construction Bid',
  NULL,
  '[
    {"name": "Price", "description": "Competitiveness of bid amount", "weight": 35, "max_score": 5},
    {"name": "Schedule", "description": "Proposed timeline and ability to meet deadlines", "weight": 20, "max_score": 5},
    {"name": "Experience", "description": "Relevant project experience and references", "weight": 20, "max_score": 5},
    {"name": "Qualifications", "description": "Licensing, bonding, insurance, safety record", "weight": 15, "max_score": 5},
    {"name": "Scope Completeness", "description": "Thoroughness and clarity of bid scope", "weight": 10, "max_score": 5}
  ]'::jsonb,
  true
) ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- FUNCTION: Calculate weighted total score for a submission
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_bid_weighted_score(p_submission_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_weighted DECIMAL(10,4) := 0;
  total_weight INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      es.score,
      sc.weight,
      sc.max_score
    FROM v2_bid_evaluation_scores es
    JOIN v2_bid_scoring_criteria sc ON es.criteria_id = sc.id
    WHERE es.submission_id = p_submission_id
  LOOP
    -- Normalize score to 0-1 range then apply weight
    total_weighted := total_weighted + ((rec.score::DECIMAL / rec.max_score) * rec.weight);
    total_weight := total_weight + rec.weight;
  END LOOP;

  IF total_weight = 0 THEN
    RETURN NULL;
  END IF;

  -- Return as percentage
  RETURN ROUND((total_weighted / total_weight) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- TRIGGER: Update submission evaluation_score when scores change
-- ============================================================
CREATE OR REPLACE FUNCTION update_submission_total_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_subcontractor_bids
  SET evaluation_score = calculate_bid_weighted_score(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.submission_id ELSE NEW.submission_id END
  )
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.submission_id ELSE NEW.submission_id END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bid_total_score ON v2_bid_evaluation_scores;
CREATE TRIGGER trigger_update_bid_total_score
  AFTER INSERT OR UPDATE OR DELETE ON v2_bid_evaluation_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_submission_total_score();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE v2_bid_scoring_criteria IS 'Configurable scoring criteria for bid evaluation';
COMMENT ON TABLE v2_bid_evaluation_scores IS 'Individual criterion scores per bid submission';
COMMENT ON TABLE v2_bid_scoring_templates IS 'Reusable scoring criteria templates';
COMMENT ON FUNCTION calculate_bid_weighted_score IS 'Calculates weighted percentage score for a submission';
