-- Create selections table
CREATE TABLE public.selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- Flooring, Cabinets, Countertops, Fixtures, Appliances, Hardware, Paint, Tile, Lighting, Plumbing, Other
  room_area TEXT, -- Kitchen, Master Bath, Living Room, etc.
  
  -- Options & Selection
  options JSONB DEFAULT '[]'::jsonb, -- Array of {name, description, cost, url, image_url}
  selected_option TEXT, -- Name of chosen option
  
  -- Financial
  allowance_amount NUMERIC(12,2) DEFAULT 0,
  actual_cost NUMERIC(12,2) DEFAULT 0,
  variance NUMERIC(12,2) GENERATED ALWAYS AS (allowance_amount - actual_cost) STORED,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  
  -- Procurement
  vendor_id UUID REFERENCES public.vendors(id),
  lead_time_days INTEGER,
  order_status TEXT DEFAULT 'not_ordered', -- not_ordered, ordered, shipped, received, installed
  ordered_at TIMESTAMP WITH TIME ZONE,
  expected_delivery DATE,
  po_id UUID REFERENCES public.purchase_orders(id),
  
  -- Approval workflow
  approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  client_notes TEXT,
  
  -- Visual references
  image_url TEXT,
  reference_url TEXT,
  
  -- Metadata
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;

-- Create policies (open access for now, can tighten later)
CREATE POLICY "Allow all access to selections" 
ON public.selections 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_selections_updated_at
BEFORE UPDATE ON public.selections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_selections_job_id ON public.selections(job_id);
CREATE INDEX idx_selections_category ON public.selections(category);
CREATE INDEX idx_selections_room_area ON public.selections(room_area);
CREATE INDEX idx_selections_approval_status ON public.selections(approval_status);