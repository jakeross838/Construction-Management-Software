-- Add task_type column for universal color coding
ALTER TABLE public.schedule_tasks 
ADD COLUMN task_type TEXT DEFAULT 'work';

-- Add comment explaining the task types
COMMENT ON COLUMN public.schedule_tasks.task_type IS 'Task type for color coding: work, inspection, delivery, milestone, meeting, walkthrough, punch_list';

-- Update existing tasks to have work type
UPDATE public.schedule_tasks SET task_type = 'work' WHERE task_type IS NULL;