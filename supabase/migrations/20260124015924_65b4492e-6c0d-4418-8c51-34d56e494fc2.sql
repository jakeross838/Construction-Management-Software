-- Replace priority column with critical_path boolean
ALTER TABLE public.schedule_tasks 
  DROP COLUMN IF EXISTS priority;

ALTER TABLE public.schedule_tasks 
  ADD COLUMN critical_path boolean NOT NULL DEFAULT false;

-- Add predecessor_type column for SS (start-to-start) and FS (finish-to-start) link types
-- Store as JSONB array with predecessor id and type: [{"task_id": "uuid", "type": "FS"}]
ALTER TABLE public.schedule_tasks 
  DROP COLUMN IF EXISTS predecessors;

ALTER TABLE public.schedule_tasks 
  ADD COLUMN predecessors jsonb DEFAULT '[]'::jsonb;