
-- Add INSERT, UPDATE, DELETE policies for cost_codes
CREATE POLICY "Cost codes can be inserted by anyone" 
ON public.cost_codes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Cost codes can be updated by anyone" 
ON public.cost_codes 
FOR UPDATE 
USING (true);

CREATE POLICY "Cost codes can be deleted by anyone" 
ON public.cost_codes 
FOR DELETE 
USING (true);
