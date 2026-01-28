-- Add confirmed_at timestamp to schedule_tasks for tracking subcontractor confirmations
ALTER TABLE public.schedule_tasks 
ADD COLUMN confirmed_at timestamp with time zone DEFAULT NULL;

-- Add confirmed_by to track who marked it as confirmed
ALTER TABLE public.schedule_tasks 
ADD COLUMN confirmed_by character varying DEFAULT NULL;