-- Create permits table
CREATE TABLE public.permits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  number VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'not_submitted',
  submitted_date DATE,
  approved_date DATE,
  expires_date DATE,
  jurisdiction VARCHAR,
  inspector_name VARCHAR,
  inspector_phone VARCHAR,
  inspector_email VARCHAR,
  fee_amount NUMERIC,
  fee_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Permits are viewable by everyone" 
ON public.permits FOR SELECT USING (true);

CREATE POLICY "Permits can be inserted by anyone" 
ON public.permits FOR INSERT WITH CHECK (true);

CREATE POLICY "Permits can be updated by anyone" 
ON public.permits FOR UPDATE USING (true);

CREATE POLICY "Permits can be deleted by anyone" 
ON public.permits FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_permits_updated_at
BEFORE UPDATE ON public.permits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();