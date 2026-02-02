-- Migration 165: Punch List Mobile Enhancements
-- Phase 5 Mobile & Field: Photo annotation, swipe-to-complete support, QR code locations

-- ============================================================
-- JOB LOCATIONS TABLE (for QR code scanning)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  qr_code TEXT UNIQUE NOT NULL, -- Unique identifier for QR scanning
  floor TEXT,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job locations
CREATE INDEX IF NOT EXISTS idx_job_locations_job ON v2_job_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_locations_qr_code ON v2_job_locations(qr_code);

-- ============================================================
-- ENHANCE PUNCH LIST ITEMS FOR MOBILE
-- ============================================================

-- Add location QR code reference to punch list items
ALTER TABLE v2_punch_list_items
  ADD COLUMN IF NOT EXISTS location_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES v2_job_locations(id),
  ADD COLUMN IF NOT EXISTS completed_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- Index for location lookups
CREATE INDEX IF NOT EXISTS idx_punch_items_location ON v2_punch_list_items(location_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_qr ON v2_punch_list_items(location_qr_code);

-- ============================================================
-- ANNOTATED PHOTOS TABLE
-- ============================================================

-- Store photo annotations separately for flexibility
CREATE TABLE IF NOT EXISTS v2_punch_list_photo_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES v2_punch_list_attachments(id) ON DELETE CASCADE,
  punch_list_id UUID NOT NULL REFERENCES v2_punch_lists(id) ON DELETE CASCADE,
  item_id UUID REFERENCES v2_punch_list_items(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  annotated_url TEXT NOT NULL,
  annotations JSONB DEFAULT '[]', -- Array of annotation objects: { type, x, y, width, height, color, text, etc. }
  annotated_by TEXT,
  annotated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for annotations
CREATE INDEX IF NOT EXISTS idx_photo_annotations_attachment ON v2_punch_list_photo_annotations(attachment_id);
CREATE INDEX IF NOT EXISTS idx_photo_annotations_punch_list ON v2_punch_list_photo_annotations(punch_list_id);
CREATE INDEX IF NOT EXISTS idx_photo_annotations_item ON v2_punch_list_photo_annotations(item_id);

-- ============================================================
-- ADD ANNOTATED FLAG TO ATTACHMENTS
-- ============================================================

ALTER TABLE v2_punch_list_attachments
  ADD COLUMN IF NOT EXISTS has_annotation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS annotated_url TEXT;

-- ============================================================
-- QUICK COMPLETE TRACKING (for swipe-to-complete analytics)
-- ============================================================

-- Track quick completions for mobile workflow optimization
ALTER TABLE v2_punch_list_activity
  ADD COLUMN IF NOT EXISTS completion_method TEXT; -- 'swipe', 'button', 'api'

-- ============================================================
-- HELPER FUNCTION: Generate unique QR code
-- ============================================================

CREATE OR REPLACE FUNCTION generate_location_qr_code(p_job_id UUID, p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_job_identifier TEXT;
  v_qr_code TEXT;
  v_counter INTEGER := 0;
BEGIN
  -- Get job identifier from job name
  SELECT REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), '(.{12}).*', '\1')
  INTO v_job_identifier
  FROM v2_jobs
  WHERE id = p_job_id;

  -- Generate base QR code
  v_qr_code := UPPER(v_job_identifier) || '-' || UPPER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '', 'g'));
  v_qr_code := LEFT(v_qr_code, 20);

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM v2_job_locations WHERE qr_code = v_qr_code || CASE WHEN v_counter > 0 THEN '-' || v_counter ELSE '' END) LOOP
    v_counter := v_counter + 1;
  END LOOP;

  IF v_counter > 0 THEN
    v_qr_code := v_qr_code || '-' || v_counter;
  END IF;

  RETURN v_qr_code;
END;
$$ LANGUAGE plpgsql;
