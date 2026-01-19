-- Migration 063: Project Closeout
-- Manage project closeout process including punch lists, inspections, certificates, and documentation

-- ============================================================
-- CLOSEOUT PACKAGES (main tracking entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_closeout_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Package identification
  package_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Status: draft, in_progress, pending_review, completed
  status TEXT DEFAULT 'draft',

  -- Dates
  target_completion_date DATE,
  actual_completion_date DATE,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, package_number)
);

-- ============================================================
-- PUNCH LIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  closeout_package_id UUID REFERENCES v2_closeout_packages(id) ON DELETE SET NULL,

  -- Item identification
  item_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Location
  location TEXT,
  room TEXT,
  floor TEXT,

  -- Classification
  category TEXT, -- electrical, plumbing, hvac, finish, structural, other
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  trade TEXT, -- responsible trade/contractor

  -- Assignment
  assigned_to TEXT,
  assigned_vendor_id UUID REFERENCES v2_vendors(id),

  -- Status: open, in_progress, completed, verified, rejected
  status TEXT DEFAULT 'open',

  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,

  -- Cost tracking
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  back_charge BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, item_number)
);

-- ============================================================
-- PUNCH LIST PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_punch_list_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_item_id UUID NOT NULL REFERENCES v2_punch_list_items(id) ON DELETE CASCADE,

  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  photo_type TEXT DEFAULT 'issue', -- issue, progress, completed

  caption TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINAL INSPECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_final_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  closeout_package_id UUID REFERENCES v2_closeout_packages(id) ON DELETE SET NULL,

  -- Inspection identification
  inspection_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Type
  inspection_type TEXT NOT NULL, -- building, electrical, plumbing, mechanical, fire, elevator, health, final

  -- Inspector info
  inspector_name TEXT,
  inspector_agency TEXT,
  inspector_phone TEXT,
  inspector_email TEXT,

  -- Status: scheduled, passed, failed, conditional, cancelled
  status TEXT DEFAULT 'scheduled',

  -- Dates
  scheduled_date DATE,
  inspection_date DATE,
  expiration_date DATE,

  -- Results
  result_notes TEXT,
  conditions TEXT,
  reinspection_required BOOLEAN DEFAULT false,
  reinspection_date DATE,

  -- Certificate/Permit info
  permit_number TEXT,
  certificate_number TEXT,
  certificate_url TEXT,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, inspection_number)
);

-- ============================================================
-- CLOSEOUT DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_closeout_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  closeout_package_id UUID REFERENCES v2_closeout_packages(id) ON DELETE SET NULL,

  -- Document identification
  name TEXT NOT NULL,
  description TEXT,

  -- Classification
  document_type TEXT NOT NULL, -- as_built, o_and_m, warranty, certificate, lien_waiver, training, permit, other
  category TEXT, -- architectural, structural, mechanical, electrical, plumbing, civil, general

  -- File info
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,

  -- Status: required, pending, submitted, approved, rejected
  status TEXT DEFAULT 'required',

  -- Vendor/Contractor
  vendor_id UUID REFERENCES v2_vendors(id),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,

  -- Review
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Dates
  due_date DATE,
  expiration_date DATE,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- LIEN WAIVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lien_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  closeout_package_id UUID REFERENCES v2_closeout_packages(id) ON DELETE SET NULL,

  -- Waiver identification
  waiver_number TEXT NOT NULL,

  -- Vendor info
  vendor_id UUID REFERENCES v2_vendors(id),
  vendor_name TEXT NOT NULL,

  -- Type: conditional, unconditional
  waiver_type TEXT NOT NULL DEFAULT 'conditional',
  -- Scope: progress, final
  scope TEXT NOT NULL DEFAULT 'progress',

  -- Amount
  through_date DATE,
  amount DECIMAL(12,2),
  exceptions TEXT,

  -- Status: requested, received, approved
  status TEXT DEFAULT 'requested',

  -- File
  file_url TEXT,
  file_name TEXT,

  -- Dates
  requested_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, waiver_number)
);

-- ============================================================
-- CLOSEOUT CHECKLIST TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_closeout_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  closeout_package_id UUID REFERENCES v2_closeout_packages(id) ON DELETE SET NULL,

  -- Item info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- documentation, inspections, warranties, training, financial, administrative

  -- Order
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_required BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  -- Link to related entity
  related_type TEXT, -- inspection, document, lien_waiver, punch_list
  related_id UUID,

  -- Due date
  due_date DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_closeout_packages_job_id ON v2_closeout_packages(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_packages_status ON v2_closeout_packages(status);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_packages_deleted_at ON v2_closeout_packages(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_punch_list_items_job_id ON v2_punch_list_items(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_punch_list_items_package_id ON v2_punch_list_items(closeout_package_id);
CREATE INDEX IF NOT EXISTS idx_v2_punch_list_items_status ON v2_punch_list_items(status);
CREATE INDEX IF NOT EXISTS idx_v2_punch_list_items_assigned_vendor ON v2_punch_list_items(assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_punch_list_items_deleted_at ON v2_punch_list_items(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_punch_list_photos_item_id ON v2_punch_list_photos(punch_list_item_id);

CREATE INDEX IF NOT EXISTS idx_v2_final_inspections_job_id ON v2_final_inspections(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_final_inspections_package_id ON v2_final_inspections(closeout_package_id);
CREATE INDEX IF NOT EXISTS idx_v2_final_inspections_status ON v2_final_inspections(status);
CREATE INDEX IF NOT EXISTS idx_v2_final_inspections_deleted_at ON v2_final_inspections(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_closeout_documents_job_id ON v2_closeout_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_documents_package_id ON v2_closeout_documents(closeout_package_id);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_documents_status ON v2_closeout_documents(status);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_documents_type ON v2_closeout_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_documents_deleted_at ON v2_closeout_documents(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_lien_waivers_job_id ON v2_lien_waivers(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_lien_waivers_package_id ON v2_lien_waivers(closeout_package_id);
CREATE INDEX IF NOT EXISTS idx_v2_lien_waivers_vendor_id ON v2_lien_waivers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_lien_waivers_status ON v2_lien_waivers(status);
CREATE INDEX IF NOT EXISTS idx_v2_lien_waivers_deleted_at ON v2_lien_waivers(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_closeout_checklist_items_job_id ON v2_closeout_checklist_items(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_closeout_checklist_items_package_id ON v2_closeout_checklist_items(closeout_package_id);

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_closeout_package_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_closeout_package_updated_at ON v2_closeout_packages;
CREATE TRIGGER trigger_closeout_package_updated_at
  BEFORE UPDATE ON v2_closeout_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_closeout_package_updated_at();

CREATE OR REPLACE FUNCTION update_punch_list_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_punch_list_item_updated_at ON v2_punch_list_items;
CREATE TRIGGER trigger_punch_list_item_updated_at
  BEFORE UPDATE ON v2_punch_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_punch_list_item_updated_at();

CREATE OR REPLACE FUNCTION update_final_inspection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_final_inspection_updated_at ON v2_final_inspections;
CREATE TRIGGER trigger_final_inspection_updated_at
  BEFORE UPDATE ON v2_final_inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_final_inspection_updated_at();

CREATE OR REPLACE FUNCTION update_closeout_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_closeout_document_updated_at ON v2_closeout_documents;
CREATE TRIGGER trigger_closeout_document_updated_at
  BEFORE UPDATE ON v2_closeout_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_closeout_document_updated_at();

CREATE OR REPLACE FUNCTION update_lien_waiver_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lien_waiver_updated_at ON v2_lien_waivers;
CREATE TRIGGER trigger_lien_waiver_updated_at
  BEFORE UPDATE ON v2_lien_waivers
  FOR EACH ROW
  EXECUTE FUNCTION update_lien_waiver_updated_at();

-- ============================================================
-- AUTO-GENERATE NUMBERS
-- ============================================================

-- Closeout package number
CREATE OR REPLACE FUNCTION generate_closeout_package_number()
RETURNS TRIGGER AS $$
DECLARE
  job_prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
    'JOB'
  ) INTO job_prefix FROM v2_jobs WHERE id = NEW.job_id;

  SELECT COALESCE(MAX(
    CASE
      WHEN package_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(package_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_closeout_packages WHERE job_id = NEW.job_id;

  NEW.package_number := 'CLO-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_closeout_package_number ON v2_closeout_packages;
CREATE TRIGGER trigger_generate_closeout_package_number
  BEFORE INSERT ON v2_closeout_packages
  FOR EACH ROW
  WHEN (NEW.package_number IS NULL OR NEW.package_number = '')
  EXECUTE FUNCTION generate_closeout_package_number();

-- Punch list item number
CREATE OR REPLACE FUNCTION generate_punch_list_item_number()
RETURNS TRIGGER AS $$
DECLARE
  job_prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
    'JOB'
  ) INTO job_prefix FROM v2_jobs WHERE id = NEW.job_id;

  SELECT COALESCE(MAX(
    CASE
      WHEN item_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(item_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_punch_list_items WHERE job_id = NEW.job_id;

  NEW.item_number := 'PLI-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_punch_list_item_number ON v2_punch_list_items;
CREATE TRIGGER trigger_generate_punch_list_item_number
  BEFORE INSERT ON v2_punch_list_items
  FOR EACH ROW
  WHEN (NEW.item_number IS NULL OR NEW.item_number = '')
  EXECUTE FUNCTION generate_punch_list_item_number();

-- Inspection number
CREATE OR REPLACE FUNCTION generate_inspection_number()
RETURNS TRIGGER AS $$
DECLARE
  job_prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
    'JOB'
  ) INTO job_prefix FROM v2_jobs WHERE id = NEW.job_id;

  SELECT COALESCE(MAX(
    CASE
      WHEN inspection_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(inspection_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_final_inspections WHERE job_id = NEW.job_id;

  NEW.inspection_number := 'INS-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_inspection_number ON v2_final_inspections;
CREATE TRIGGER trigger_generate_inspection_number
  BEFORE INSERT ON v2_final_inspections
  FOR EACH ROW
  WHEN (NEW.inspection_number IS NULL OR NEW.inspection_number = '')
  EXECUTE FUNCTION generate_inspection_number();

-- Lien waiver number
CREATE OR REPLACE FUNCTION generate_lien_waiver_number()
RETURNS TRIGGER AS $$
DECLARE
  job_prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
    'JOB'
  ) INTO job_prefix FROM v2_jobs WHERE id = NEW.job_id;

  SELECT COALESCE(MAX(
    CASE
      WHEN waiver_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(waiver_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_lien_waivers WHERE job_id = NEW.job_id;

  NEW.waiver_number := 'LW-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_lien_waiver_number ON v2_lien_waivers;
CREATE TRIGGER trigger_generate_lien_waiver_number
  BEFORE INSERT ON v2_lien_waivers
  FOR EACH ROW
  WHEN (NEW.waiver_number IS NULL OR NEW.waiver_number = '')
  EXECUTE FUNCTION generate_lien_waiver_number();

-- ============================================================
-- UPDATE PACKAGE PROGRESS
-- ============================================================
CREATE OR REPLACE FUNCTION update_closeout_package_progress()
RETURNS TRIGGER AS $$
DECLARE
  pkg_id UUID;
BEGIN
  -- Get the package ID (handle INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    pkg_id := OLD.closeout_package_id;
  ELSE
    pkg_id := NEW.closeout_package_id;
  END IF;

  -- Only update if there's a package
  IF pkg_id IS NOT NULL THEN
    UPDATE v2_closeout_packages
    SET
      total_items = (
        SELECT COUNT(*) FROM v2_punch_list_items
        WHERE closeout_package_id = pkg_id
        AND deleted_at IS NULL
      ),
      completed_items = (
        SELECT COUNT(*) FROM v2_punch_list_items
        WHERE closeout_package_id = pkg_id
        AND deleted_at IS NULL
        AND status IN ('completed', 'verified')
      )
    WHERE id = pkg_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_closeout_package_progress ON v2_punch_list_items;
CREATE TRIGGER trigger_update_closeout_package_progress
  AFTER INSERT OR UPDATE OR DELETE ON v2_punch_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_closeout_package_progress();
