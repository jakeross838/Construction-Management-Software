-- Add columns to invoices for enhanced AI processing
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS review_flags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS matched_confidence jsonb DEFAULT '{}';

-- AI Learning: Vendor aliases (alternative names that map to the same vendor)
CREATE TABLE IF NOT EXISTS public.vendor_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  source text DEFAULT 'manual', -- 'manual', 'ai_correction', 'import'
  use_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alias_name)
);

-- AI Learning: General learned mappings for improving AI matching over time
CREATE TABLE IF NOT EXISTS public.ai_learned_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'vendor', 'job', 'cost_code'
  extracted_value text NOT NULL, -- The raw value AI extracted
  matched_id uuid NOT NULL, -- The correct entity ID user selected
  confidence numeric DEFAULT 0.95, -- How confident to be next time
  use_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entity_type, extracted_value)
);

-- Trade type to cost code default mappings
CREATE TABLE IF NOT EXISTS public.trade_cost_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type text NOT NULL,
  cost_code_id uuid NOT NULL REFERENCES public.cost_codes(id) ON DELETE CASCADE,
  priority integer DEFAULT 1, -- Lower = higher priority
  created_at timestamptz DEFAULT now(),
  UNIQUE(trade_type, cost_code_id)
);

-- Description keyword to cost code mappings
CREATE TABLE IF NOT EXISTS public.description_cost_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  cost_code_id uuid NOT NULL REFERENCES public.cost_codes(id) ON DELETE CASCADE,
  match_type text DEFAULT 'contains', -- 'exact', 'contains', 'starts_with'
  priority integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(keyword, cost_code_id)
);

-- Add trade_type to vendors if not exists
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS trade_type text;

-- Enable RLS on new tables
ALTER TABLE public.vendor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learned_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_cost_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.description_cost_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_aliases
CREATE POLICY "Allow all operations on vendor_aliases" ON public.vendor_aliases
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for ai_learned_mappings
CREATE POLICY "Allow all operations on ai_learned_mappings" ON public.ai_learned_mappings
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for trade_cost_mappings
CREATE POLICY "Allow all operations on trade_cost_mappings" ON public.trade_cost_mappings
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for description_cost_mappings
CREATE POLICY "Allow all operations on description_cost_mappings" ON public.description_cost_mappings
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_vendor_id ON public.vendor_aliases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_name ON public.vendor_aliases(lower(alias_name));
CREATE INDEX IF NOT EXISTS idx_ai_learned_mappings_type ON public.ai_learned_mappings(entity_type);
CREATE INDEX IF NOT EXISTS idx_ai_learned_mappings_lookup ON public.ai_learned_mappings(entity_type, lower(extracted_value));
CREATE INDEX IF NOT EXISTS idx_trade_cost_mappings_trade ON public.trade_cost_mappings(trade_type);
CREATE INDEX IF NOT EXISTS idx_description_cost_mappings_keyword ON public.description_cost_mappings(lower(keyword));

-- Insert default trade → cost code mappings (using existing cost codes)
INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'electrical', id, 1 FROM public.cost_codes WHERE code LIKE '26%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'plumbing', id, 1 FROM public.cost_codes WHERE code LIKE '22%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'hvac', id, 1 FROM public.cost_codes WHERE code LIKE '23%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'framing', id, 1 FROM public.cost_codes WHERE code LIKE '06%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'drywall', id, 1 FROM public.cost_codes WHERE code LIKE '09%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT 'roofing', id, 1 FROM public.cost_codes WHERE code LIKE '07%' LIMIT 1
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_vendor_aliases_updated_at
  BEFORE UPDATE ON public.vendor_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_learned_mappings_updated_at
  BEFORE UPDATE ON public.ai_learned_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();