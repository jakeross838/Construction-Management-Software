-- Add delete policy for jobs table
CREATE POLICY "Jobs can be deleted by anyone"
ON public.jobs
FOR DELETE
USING (true);