-- Create estimates table for persistent storage
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Client Info
  client_name VARCHAR NOT NULL,
  client_email VARCHAR,
  client_phone VARCHAR,
  client_address TEXT,
  
  -- Project Info
  project_name VARCHAR NOT NULL,
  project_address TEXT,
  project_description TEXT DEFAULT '',
  project_square_feet INTEGER,
  project_type VARCHAR NOT NULL DEFAULT 'new_construction',
  
  -- Status & Dates
  status VARCHAR NOT NULL DEFAULT 'draft',
  sent_at DATE,
  expires_at DATE,
  approved_at DATE,
  converted_to_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  
  -- Sections (complex nested structure stored as JSONB)
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Cost Totals
  subtotal_material NUMERIC NOT NULL DEFAULT 0,
  subtotal_labor NUMERIC NOT NULL DEFAULT 0,
  subtotal_subcontractor NUMERIC NOT NULL DEFAULT 0,
  subtotal_equipment NUMERIC NOT NULL DEFAULT 0,
  subtotal_other NUMERIC NOT NULL DEFAULT 0,
  subtotal_direct NUMERIC NOT NULL DEFAULT 0,
  
  -- Markup Settings
  markup_settings JSONB NOT NULL DEFAULT '{
    "materialMarkup": 15,
    "laborMarkup": 35,
    "subcontractorMarkup": 10,
    "equipmentMarkup": 15,
    "overheadPercent": 12,
    "profitPercent": 10,
    "contingencyPercent": 5
  }'::jsonb,
  
  -- Calculated Amounts
  overhead_amount NUMERIC NOT NULL DEFAULT 0,
  profit_amount NUMERIC NOT NULL DEFAULT 0,
  contingency_amount NUMERIC NOT NULL DEFAULT 0,
  total_before_contingency NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Allowances
  allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_allowances NUMERIC NOT NULL DEFAULT 0,
  
  -- Terms
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_and_conditions TEXT,
  
  -- Metadata
  created_by VARCHAR NOT NULL DEFAULT 'System',
  assigned_to VARCHAR,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for full CRUD access
CREATE POLICY "Estimates are viewable by everyone"
ON public.estimates FOR SELECT
USING (true);

CREATE POLICY "Estimates can be inserted by anyone"
ON public.estimates FOR INSERT
WITH CHECK (true);

CREATE POLICY "Estimates can be updated by anyone"
ON public.estimates FOR UPDATE
USING (true);

CREATE POLICY "Estimates can be deleted by anyone"
ON public.estimates FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_estimates_updated_at
BEFORE UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for job-scoped queries
CREATE INDEX idx_estimates_job_id ON public.estimates(job_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);
CREATE INDEX idx_estimates_number ON public.estimates(number);