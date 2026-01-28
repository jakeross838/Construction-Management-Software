-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false);

-- Allow authenticated users to upload invoices
CREATE POLICY "Users can upload invoices"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to read invoices
CREATE POLICY "Users can read invoices"
ON storage.objects
FOR SELECT
USING (bucket_id = 'invoices');

-- Allow authenticated users to delete invoices
CREATE POLICY "Users can delete invoices"
ON storage.objects
FOR DELETE
USING (bucket_id = 'invoices');