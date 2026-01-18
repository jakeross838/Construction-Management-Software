-- Migration 046: Photos System
-- Job progress documentation through photos with metadata and entity linking

-- Main photos table
CREATE TABLE IF NOT EXISTS v2_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  file_url TEXT NOT NULL,
  file_name TEXT,
  thumbnail_url TEXT,                    -- For gallery grid performance
  caption TEXT,
  location TEXT,                         -- Area/room within job site
  category TEXT DEFAULT 'progress' CHECK (category IN ('progress', 'exterior', 'interior', 'detail', 'issue', 'completion')),
  taken_at TIMESTAMPTZ,                  -- When photo was taken (from EXIF or manual)
  latitude DECIMAL(10,8),                -- GPS if available
  longitude DECIMAL(11,8),
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                 -- Soft delete
);

-- Junction table for entity linking
CREATE TABLE IF NOT EXISTS v2_photo_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES v2_photos(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('inspection', 'punch_item', 'daily_log')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, entity_type, entity_id)
);

-- Activity/audit trail
CREATE TABLE IF NOT EXISTS v2_photo_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES v2_photos(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_job ON v2_photos(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_category ON v2_photos(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_taken ON v2_photos(taken_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_links_photo ON v2_photo_links(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_links_entity ON v2_photo_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_photo_activity_photo ON v2_photo_activity(photo_id);
