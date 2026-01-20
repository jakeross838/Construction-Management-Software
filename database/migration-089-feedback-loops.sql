-- Migration 089: Feedback Loops (Phase 76)
-- System learns from corrections, improves over time

-- ============================================================
-- 1. AI PREDICTIONS LOG (Track all AI predictions)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was predicted
  prediction_type TEXT NOT NULL CHECK (prediction_type IN (
    'invoice_extraction', 'vendor_match', 'job_match', 'cost_code_match',
    'document_classification', 'estimate_suggestion', 'schedule_duration',
    'vendor_score', 'duplicate_detection', 'other'
  )),

  -- Entity context
  entity_type TEXT,  -- 'invoice', 'document', 'po', etc.
  entity_id UUID,

  -- The prediction
  predicted_value JSONB NOT NULL,  -- What AI predicted
  confidence DECIMAL(5,2),

  -- Outcome
  was_correct BOOLEAN,
  corrected_value JSONB,  -- What user changed it to
  correction_type TEXT CHECK (correction_type IN ('none', 'minor', 'major', 'rejected')),

  -- Context for learning
  input_features JSONB,  -- What inputs led to this prediction
  model_version TEXT,

  -- Timing
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ,

  -- Who
  corrected_by TEXT
);

CREATE INDEX idx_ai_predictions_type ON v2_ai_predictions(prediction_type);
CREATE INDEX idx_ai_predictions_correct ON v2_ai_predictions(was_correct) WHERE was_correct IS NOT NULL;
CREATE INDEX idx_ai_predictions_date ON v2_ai_predictions(predicted_at DESC);

-- ============================================================
-- 2. CORRECTION PATTERNS (Identify recurring mistakes)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_correction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern info
  pattern_type TEXT NOT NULL,  -- 'vendor_name', 'cost_code', 'amount', etc.
  pattern_description TEXT,

  -- The pattern
  incorrect_pattern JSONB NOT NULL,  -- What AI typically gets wrong
  correct_pattern JSONB NOT NULL,    -- What it should be

  -- Frequency
  occurrence_count INTEGER DEFAULT 1,
  last_occurred_at TIMESTAMPTZ DEFAULT NOW(),

  -- Learning rule
  should_auto_correct BOOLEAN DEFAULT false,
  rule_confidence DECIMAL(5,2),

  -- Status
  status TEXT CHECK (status IN ('active', 'confirmed', 'deprecated')) DEFAULT 'active',
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correction_patterns_type ON v2_correction_patterns(pattern_type);
CREATE INDEX idx_correction_patterns_active ON v2_correction_patterns(status) WHERE status = 'active';

-- ============================================================
-- 3. USER FEEDBACK (Explicit user ratings)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What they're rating
  feature_area TEXT NOT NULL CHECK (feature_area IN (
    'invoice_processing', 'document_management', 'estimation',
    'scheduling', 'vendor_management', 'reporting', 'search',
    'mobile', 'general', 'other'
  )),

  -- Optional entity link
  entity_type TEXT,
  entity_id UUID,

  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Details
  feedback_text TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Issue tracking
  is_bug_report BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,

  -- User
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_area ON v2_user_feedback(feature_area);
CREATE INDEX idx_user_feedback_rating ON v2_user_feedback(rating);
CREATE INDEX idx_user_feedback_unresolved ON v2_user_feedback(resolved) WHERE resolved = false AND is_bug_report = true;

-- ============================================================
-- 4. ACCURACY METRICS (Daily accuracy tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_accuracy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period
  metric_date DATE NOT NULL,
  prediction_type TEXT NOT NULL,

  -- Counts
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  minor_corrections INTEGER DEFAULT 0,
  major_corrections INTEGER DEFAULT 0,
  rejections INTEGER DEFAULT 0,

  -- Calculated
  accuracy_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_predictions > 0
      THEN (correct_predictions::DECIMAL / total_predictions * 100)
      ELSE 0
    END
  ) STORED,

  -- Confidence calibration
  avg_confidence DECIMAL(5,2),
  confidence_when_correct DECIMAL(5,2),
  confidence_when_wrong DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(metric_date, prediction_type)
);

CREATE INDEX idx_accuracy_metrics_date ON v2_accuracy_metrics(metric_date DESC);
CREATE INDEX idx_accuracy_metrics_type ON v2_accuracy_metrics(prediction_type);

-- ============================================================
-- 5. LEARNING RULES (Auto-correction rules from patterns)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_learning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule definition
  rule_name TEXT NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('substitution', 'mapping', 'validation', 'enhancement')),

  -- Conditions
  applies_to TEXT NOT NULL,  -- 'vendor_name', 'cost_code', etc.
  condition JSONB NOT NULL,  -- When to apply
  action JSONB NOT NULL,     -- What to do

  -- Derived from
  source_pattern_id UUID REFERENCES v2_correction_patterns(id),

  -- Confidence
  confidence DECIMAL(5,2),
  times_applied INTEGER DEFAULT 0,
  times_overridden INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_rules_active ON v2_learning_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_learning_rules_type ON v2_learning_rules(applies_to);

-- ============================================================
-- 6. SYSTEM HEALTH METRICS (Overall system performance)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  metric_date DATE NOT NULL UNIQUE,

  -- Processing metrics
  invoices_processed INTEGER DEFAULT 0,
  documents_processed INTEGER DEFAULT 0,
  estimates_created INTEGER DEFAULT 0,
  schedules_generated INTEGER DEFAULT 0,

  -- Accuracy metrics
  overall_accuracy DECIMAL(5,2),
  invoice_accuracy DECIMAL(5,2),
  document_accuracy DECIMAL(5,2),

  -- User engagement
  active_users INTEGER DEFAULT 0,
  feedback_count INTEGER DEFAULT 0,
  avg_feedback_rating DECIMAL(3,2),

  -- Performance
  avg_processing_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. FUNCTION: Log AI prediction
-- ============================================================
CREATE OR REPLACE FUNCTION log_ai_prediction(
  p_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_predicted_value JSONB,
  p_confidence DECIMAL,
  p_input_features JSONB DEFAULT NULL,
  p_model_version TEXT DEFAULT 'v1'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO v2_ai_predictions (
    prediction_type, entity_type, entity_id,
    predicted_value, confidence, input_features, model_version
  )
  VALUES (
    p_type, p_entity_type, p_entity_id,
    p_predicted_value, p_confidence, p_input_features, p_model_version
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCTION: Record correction
-- ============================================================
CREATE OR REPLACE FUNCTION record_prediction_correction(
  p_prediction_id UUID,
  p_corrected_value JSONB,
  p_corrected_by TEXT
)
RETURNS void AS $$
DECLARE
  v_original JSONB;
  v_correction_type TEXT;
BEGIN
  -- Get original prediction
  SELECT predicted_value INTO v_original
  FROM v2_ai_predictions
  WHERE id = p_prediction_id;

  -- Determine correction severity
  IF p_corrected_value IS NULL OR p_corrected_value = v_original THEN
    v_correction_type := 'none';
  ELSIF p_corrected_value::TEXT = '{}' OR p_corrected_value::TEXT = 'null' THEN
    v_correction_type := 'rejected';
  ELSIF jsonb_typeof(v_original) = 'object' AND jsonb_typeof(p_corrected_value) = 'object' THEN
    -- Compare keys to determine if minor or major
    IF (SELECT COUNT(*) FROM jsonb_object_keys(v_original) k
        WHERE v_original->k != p_corrected_value->k) <= 1 THEN
      v_correction_type := 'minor';
    ELSE
      v_correction_type := 'major';
    END IF;
  ELSE
    v_correction_type := 'major';
  END IF;

  -- Update prediction record
  UPDATE v2_ai_predictions SET
    was_correct = (v_correction_type = 'none'),
    corrected_value = p_corrected_value,
    correction_type = v_correction_type,
    corrected_by = p_corrected_by,
    evaluated_at = NOW()
  WHERE id = p_prediction_id;

  -- If there was a correction, look for patterns
  IF v_correction_type IN ('minor', 'major', 'rejected') THEN
    PERFORM identify_correction_pattern(p_prediction_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. FUNCTION: Identify correction patterns
-- ============================================================
CREATE OR REPLACE FUNCTION identify_correction_pattern(p_prediction_id UUID)
RETURNS void AS $$
DECLARE
  v_pred RECORD;
  v_existing_pattern UUID;
BEGIN
  -- Get the prediction
  SELECT * INTO v_pred
  FROM v2_ai_predictions
  WHERE id = p_prediction_id;

  IF v_pred IS NULL THEN RETURN; END IF;

  -- Check for existing similar pattern
  SELECT id INTO v_existing_pattern
  FROM v2_correction_patterns
  WHERE pattern_type = v_pred.prediction_type
    AND incorrect_pattern = v_pred.predicted_value
    AND correct_pattern = v_pred.corrected_value
  LIMIT 1;

  IF v_existing_pattern IS NOT NULL THEN
    -- Update existing pattern
    UPDATE v2_correction_patterns SET
      occurrence_count = occurrence_count + 1,
      last_occurred_at = NOW(),
      updated_at = NOW()
    WHERE id = v_existing_pattern;
  ELSE
    -- Create new pattern if prediction was wrong
    IF v_pred.was_correct = false THEN
      INSERT INTO v2_correction_patterns (
        pattern_type,
        incorrect_pattern,
        correct_pattern
      ) VALUES (
        v_pred.prediction_type,
        v_pred.predicted_value,
        v_pred.corrected_value
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. FUNCTION: Update daily accuracy metrics
-- ============================================================
CREATE OR REPLACE FUNCTION update_accuracy_metrics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  -- Update metrics for each prediction type
  INSERT INTO v2_accuracy_metrics (
    metric_date,
    prediction_type,
    total_predictions,
    correct_predictions,
    minor_corrections,
    major_corrections,
    rejections,
    avg_confidence,
    confidence_when_correct,
    confidence_when_wrong
  )
  SELECT
    p_date,
    prediction_type,
    COUNT(*),
    COUNT(*) FILTER (WHERE was_correct = true),
    COUNT(*) FILTER (WHERE correction_type = 'minor'),
    COUNT(*) FILTER (WHERE correction_type = 'major'),
    COUNT(*) FILTER (WHERE correction_type = 'rejected'),
    AVG(confidence),
    AVG(confidence) FILTER (WHERE was_correct = true),
    AVG(confidence) FILTER (WHERE was_correct = false)
  FROM v2_ai_predictions
  WHERE DATE(predicted_at) = p_date
    AND was_correct IS NOT NULL
  GROUP BY prediction_type
  ON CONFLICT (metric_date, prediction_type) DO UPDATE SET
    total_predictions = EXCLUDED.total_predictions,
    correct_predictions = EXCLUDED.correct_predictions,
    minor_corrections = EXCLUDED.minor_corrections,
    major_corrections = EXCLUDED.major_corrections,
    rejections = EXCLUDED.rejections,
    avg_confidence = EXCLUDED.avg_confidence,
    confidence_when_correct = EXCLUDED.confidence_when_correct,
    confidence_when_wrong = EXCLUDED.confidence_when_wrong;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. FUNCTION: Get accuracy trend
-- ============================================================
CREATE OR REPLACE FUNCTION get_accuracy_trend(
  p_prediction_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  metric_date DATE,
  prediction_type TEXT,
  total_predictions INTEGER,
  accuracy_percent DECIMAL,
  avg_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.metric_date,
    am.prediction_type,
    am.total_predictions,
    am.accuracy_percent,
    am.avg_confidence
  FROM v2_accuracy_metrics am
  WHERE am.metric_date >= CURRENT_DATE - p_days
    AND (p_prediction_type IS NULL OR am.prediction_type = p_prediction_type)
  ORDER BY am.metric_date DESC, am.prediction_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. FUNCTION: Get high-value correction patterns
-- ============================================================
CREATE OR REPLACE FUNCTION get_correction_patterns_for_learning(p_min_occurrences INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  pattern_type TEXT,
  incorrect_pattern JSONB,
  correct_pattern JSONB,
  occurrence_count INTEGER,
  suggested_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.pattern_type,
    cp.incorrect_pattern,
    cp.correct_pattern,
    cp.occurrence_count,
    LEAST(95, 50 + (cp.occurrence_count * 10))::DECIMAL as suggested_confidence
  FROM v2_correction_patterns cp
  WHERE cp.occurrence_count >= p_min_occurrences
    AND cp.status = 'active'
    AND cp.should_auto_correct = false
  ORDER BY cp.occurrence_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. VIEW: Feedback summary
-- ============================================================
CREATE OR REPLACE VIEW v2_feedback_summary AS
SELECT
  feature_area,
  COUNT(*) as total_feedback,
  ROUND(AVG(rating), 2) as avg_rating,
  COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
  COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
  COUNT(*) FILTER (WHERE is_bug_report = true AND resolved = false) as open_bugs,
  MAX(submitted_at) as last_feedback
FROM v2_user_feedback
GROUP BY feature_area;

-- ============================================================
-- 14. VIEW: Learning dashboard
-- ============================================================
CREATE OR REPLACE VIEW v2_learning_dashboard AS
SELECT
  prediction_type,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE was_correct = true) as correct,
  COUNT(*) FILTER (WHERE was_correct = false) as incorrect,
  ROUND(
    CASE WHEN COUNT(*) > 0
      THEN COUNT(*) FILTER (WHERE was_correct = true)::DECIMAL / COUNT(*) * 100
      ELSE 0
    END, 2
  ) as accuracy_percent,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM v2_ai_predictions
WHERE predicted_at > CURRENT_DATE - 30
GROUP BY prediction_type
ORDER BY total_predictions DESC;

-- ============================================================
-- 15. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_ai_predictions IS 'Tracks all AI predictions for accuracy measurement';
COMMENT ON TABLE v2_correction_patterns IS 'Identifies recurring correction patterns for learning';
COMMENT ON TABLE v2_user_feedback IS 'Explicit user feedback and bug reports';
COMMENT ON TABLE v2_accuracy_metrics IS 'Daily aggregated accuracy metrics';
COMMENT ON TABLE v2_learning_rules IS 'Auto-correction rules derived from patterns';
COMMENT ON FUNCTION log_ai_prediction IS 'Log a new AI prediction';
COMMENT ON FUNCTION record_prediction_correction IS 'Record when a prediction was corrected';
COMMENT ON VIEW v2_learning_dashboard IS '30-day accuracy summary by prediction type';
