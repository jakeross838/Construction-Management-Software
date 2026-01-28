-- Add title, unit_cost, and quantity columns to po_line_items
ALTER TABLE public.po_line_items 
ADD COLUMN title text,
ADD COLUMN unit_cost numeric DEFAULT 0,
ADD COLUMN quantity numeric DEFAULT 1;