-- =============================================
-- SUBCONTRACTOR BID PACKAGES SYSTEM
-- =============================================

-- Main bid packages table (requests for bids we send out)
CREATE TABLE public.bid_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  package_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trade_category TEXT NOT NULL,
  scope_of_work TEXT,
  
  -- Dates
  issue_date DATE,
  due_date DATE NOT NULL,
  site_visit_date DATE,
  site_visit_time TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'receiving', 'evaluating', 'awarded', 'cancelled')),
  
  -- Specifications
  square_footage NUMERIC,
  specs_summary TEXT,
  special_requirements TEXT,
  
  -- Award info
  awarded_vendor_id UUID REFERENCES public.vendors(id),
  awarded_at TIMESTAMPTZ,
  awarded_amount NUMERIC,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents attached to bid packages (plans, specs, etc.)
CREATE TABLE public.bid_package_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_package_id UUID NOT NULL REFERENCES public.bid_packages(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('plans', 'specifications', 'scope', 'contract', 'addendum', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  version INTEGER DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by TEXT
);

-- Vendors invited to bid
CREATE TABLE public.bid_package_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_package_id UUID NOT NULL REFERENCES public.bid_packages(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_sent BOOLEAN DEFAULT false,
  invite_sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  declined BOOLEAN DEFAULT false,
  declined_reason TEXT,
  UNIQUE(bid_package_id, vendor_id)
);

-- Subcontractor bid submissions
CREATE TABLE public.subcontractor_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_package_id UUID NOT NULL REFERENCES public.bid_packages(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  -- Pricing
  bid_amount NUMERIC NOT NULL,
  unit_price_per_sf NUMERIC,
  alternate_amounts JSONB DEFAULT '[]'::jsonb,
  
  -- Scope details
  inclusions JSONB DEFAULT '[]'::jsonb,
  exclusions JSONB DEFAULT '[]'::jsonb,
  clarifications JSONB DEFAULT '[]'::jsonb,
  
  -- Timeline
  proposed_start_date DATE,
  proposed_duration_days INTEGER,
  
  -- Terms
  payment_terms TEXT,
  warranty_terms TEXT,
  bond_included BOOLEAN DEFAULT false,
  insurance_verified BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'selected', 'rejected', 'withdrawn')),
  is_lowest_bid BOOLEAN DEFAULT false,
  ranking INTEGER,
  
  -- Evaluation
  evaluation_score NUMERIC,
  evaluation_notes TEXT,
  
  -- Documents
  proposal_url TEXT,
  
  -- Metadata
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until DATE,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(bid_package_id, vendor_id)
);

-- Bid line items for detailed pricing
CREATE TABLE public.subcontractor_bid_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcontractor_bid_id UUID NOT NULL REFERENCES public.subcontractor_bids(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  amount NUMERIC NOT NULL,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bid_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_package_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_package_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_bid_items ENABLE ROW LEVEL SECURITY;

-- Open access policies (company-wide data)
CREATE POLICY "Allow all access to bid_packages" ON public.bid_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bid_package_documents" ON public.bid_package_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bid_package_invites" ON public.bid_package_invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subcontractor_bids" ON public.subcontractor_bids FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subcontractor_bid_items" ON public.subcontractor_bid_items FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_bid_packages_updated_at
  BEFORE UPDATE ON public.bid_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcontractor_bids_updated_at
  BEFORE UPDATE ON public.subcontractor_bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for bid documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bid-documents', 'bid-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bid documents
CREATE POLICY "Public read access for bid documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'bid-documents');

CREATE POLICY "Allow upload to bid documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bid-documents');

CREATE POLICY "Allow update bid documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bid-documents');

CREATE POLICY "Allow delete bid documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'bid-documents');