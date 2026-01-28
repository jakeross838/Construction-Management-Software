-- Add new fields to schedule_tasks table
ALTER TABLE public.schedule_tasks
ADD COLUMN IF NOT EXISTS phase character varying,
ADD COLUMN IF NOT EXISTS trades text[],
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS duration_days integer,
ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES public.purchase_orders(id),
ADD COLUMN IF NOT EXISTS predecessors uuid[];

-- Create index for PO relationship
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_po_id ON public.schedule_tasks(po_id);

-- Create index for filtering by tags
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_tags ON public.schedule_tasks USING GIN(tags);