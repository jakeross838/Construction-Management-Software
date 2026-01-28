-- Add cost_code_id to co_line_items table
ALTER TABLE public.co_line_items 
ADD COLUMN cost_code_id uuid REFERENCES public.cost_codes(id);

-- Create index for better query performance
CREATE INDEX idx_co_line_items_cost_code ON public.co_line_items(cost_code_id);