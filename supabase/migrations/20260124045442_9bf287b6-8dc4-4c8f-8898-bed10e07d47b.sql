-- Create lien_releases table for tracking conditional and unconditional releases per vendor/draw
CREATE TABLE public.lien_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  release_type VARCHAR NOT NULL CHECK (release_type IN ('conditional', 'unconditional')),
  amount NUMERIC NOT NULL DEFAULT 0,
  through_date DATE,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by VARCHAR,
  document_url TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'received', 'waived')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lien_releases ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Lien releases are viewable by everyone"
  ON public.lien_releases FOR SELECT
  USING (true);

CREATE POLICY "Lien releases can be inserted by anyone"
  ON public.lien_releases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Lien releases can be updated by anyone"
  ON public.lien_releases FOR UPDATE
  USING (true);

CREATE POLICY "Lien releases can be deleted by anyone"
  ON public.lien_releases FOR DELETE
  USING (true);

-- Add draw_id to change_orders for PCCO grouping
ALTER TABLE public.change_orders
  ADD COLUMN draw_id UUID REFERENCES public.draws(id) ON DELETE SET NULL;

-- Create trigger for updated_at on lien_releases
CREATE TRIGGER update_lien_releases_updated_at
  BEFORE UPDATE ON public.lien_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();