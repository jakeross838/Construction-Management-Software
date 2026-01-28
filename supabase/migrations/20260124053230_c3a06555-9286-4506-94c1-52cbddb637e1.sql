
-- Create leads table for CRM functionality
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  client_name VARCHAR,
  client_email VARCHAR,
  client_phone VARCHAR,
  address TEXT,
  description TEXT,
  estimated_value NUMERIC DEFAULT 0,
  square_footage INTEGER,
  source VARCHAR,
  stage VARCHAR NOT NULL DEFAULT 'new_inquiry',
  priority VARCHAR DEFAULT 'medium',
  assigned_to VARCHAR,
  notes TEXT,
  next_follow_up DATE,
  days_in_stage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Leads are viewable by everyone" 
ON public.leads 
FOR SELECT 
USING (true);

CREATE POLICY "Leads can be inserted by anyone" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Leads can be updated by anyone" 
ON public.leads 
FOR UPDATE 
USING (true);

CREATE POLICY "Leads can be deleted by anyone" 
ON public.leads 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
