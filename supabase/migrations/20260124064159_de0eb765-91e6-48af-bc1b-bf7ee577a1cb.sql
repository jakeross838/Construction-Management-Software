-- Create storage bucket for daily log photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-log-photos', 'daily-log-photos', true);

-- Create policy to allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload daily log photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'daily-log-photos');

-- Create policy to allow public read access
CREATE POLICY "Anyone can view daily log photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'daily-log-photos');

-- Create policy to allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete daily log photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'daily-log-photos');