-- Add monthly supervision rate to jobs table for automatic CO supervision cost calculation
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS monthly_supervision_rate numeric DEFAULT 6000;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.monthly_supervision_rate IS 'Monthly supervision cost rate for automatic change order calculations';