-- Create estimate_templates table to store reusable templates
CREATE TABLE public.estimate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  project_type TEXT DEFAULT 'new_construction',
  
  -- Template content (sections with groups/subgroups/line items)
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Markup settings to apply
  markup_settings JSONB NOT NULL DEFAULT '{
    "materialMarkup": 15,
    "laborMarkup": 35,
    "subcontractorMarkup": 10,
    "equipmentMarkup": 15,
    "overheadPercent": 12,
    "profitPercent": 10,
    "contingencyPercent": 5
  }'::jsonb,
  
  -- Standard terms
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_and_conditions TEXT,
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT 'system'
);

-- Enable RLS
ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (no auth required for now)
CREATE POLICY "Anyone can view templates" 
  ON public.estimate_templates 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create templates" 
  ON public.estimate_templates 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update templates" 
  ON public.estimate_templates 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete templates" 
  ON public.estimate_templates 
  FOR DELETE 
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_estimate_templates_updated_at
  BEFORE UPDATE ON public.estimate_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add an index for faster lookups by category and active status
CREATE INDEX idx_estimate_templates_category ON public.estimate_templates(category) WHERE is_active = true;
CREATE INDEX idx_estimate_templates_active ON public.estimate_templates(is_active, sort_order);