-- Migration 127: Add period_start and application_date to draws
-- These fields are displayed in the UI but were missing from the schema

-- Add period_start column
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS period_start DATE;

-- Add application_date column (typically set when submitting the draw)
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS application_date DATE;

-- Backfill existing draws:
-- period_start: Use day after previous draw's period_end, or job creation date if first draw
-- application_date: Use submitted_at date if submitted

-- Update application_date for submitted draws
UPDATE v2_draws
SET application_date = DATE(submitted_at)
WHERE submitted_at IS NOT NULL
  AND application_date IS NULL;

-- Update period_start for draws where we can determine it
-- For each draw, period_start is day after previous draw's period_end
WITH draw_periods AS (
  SELECT
    d.id,
    d.job_id,
    d.draw_number,
    d.period_end,
    LAG(d.period_end) OVER (PARTITION BY d.job_id ORDER BY d.draw_number) as prev_period_end
  FROM v2_draws d
)
UPDATE v2_draws d
SET period_start = COALESCE(
  dp.prev_period_end + INTERVAL '1 day',  -- Day after previous draw
  DATE(d.created_at)  -- Or use created_at as fallback for first draw
)::DATE
FROM draw_periods dp
WHERE d.id = dp.id
  AND d.period_start IS NULL;

-- Add comments
COMMENT ON COLUMN v2_draws.period_start IS 'Start date of the billing period (typically day after previous draw period_end)';
COMMENT ON COLUMN v2_draws.application_date IS 'Date the draw application was submitted';
