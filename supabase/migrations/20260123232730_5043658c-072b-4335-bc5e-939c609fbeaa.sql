-- Add actual end date field to jobs table
ALTER TABLE public.jobs ADD COLUMN actual_end_date date;