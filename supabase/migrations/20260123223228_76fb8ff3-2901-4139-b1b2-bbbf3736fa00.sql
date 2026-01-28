-- Create storage bucket for PO attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('po-attachments', 'po-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for viewing PO attachments (public read)
CREATE POLICY "PO attachments are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'po-attachments');

-- Create policy for uploading PO attachments
CREATE POLICY "Anyone can upload PO attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'po-attachments');

-- Create policy for deleting PO attachments
CREATE POLICY "Anyone can delete PO attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'po-attachments');

-- Create table to track PO attachments
CREATE TABLE public.po_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  file_name VARCHAR NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR,
  file_size INTEGER,
  uploaded_by VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.po_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "PO attachments are viewable by everyone"
ON public.po_attachments FOR SELECT
USING (true);

CREATE POLICY "PO attachments can be inserted by anyone"
ON public.po_attachments FOR INSERT
WITH CHECK (true);

CREATE POLICY "PO attachments can be deleted by anyone"
ON public.po_attachments FOR DELETE
USING (true);