-- Create schedule_tasks table for managing project schedules
CREATE TABLE public.schedule_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to VARCHAR(255),
  color VARCHAR(20) DEFAULT '#3b82f6',
  parent_task_id UUID REFERENCES public.schedule_tasks(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  percent_complete INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Schedule tasks are viewable by everyone" 
ON public.schedule_tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Schedule tasks can be inserted by anyone" 
ON public.schedule_tasks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Schedule tasks can be updated by anyone" 
ON public.schedule_tasks 
FOR UPDATE 
USING (true);

CREATE POLICY "Schedule tasks can be deleted by anyone" 
ON public.schedule_tasks 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_schedule_tasks_updated_at
BEFORE UPDATE ON public.schedule_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster job lookups
CREATE INDEX idx_schedule_tasks_job_id ON public.schedule_tasks(job_id);
CREATE INDEX idx_schedule_tasks_dates ON public.schedule_tasks(start_date, end_date);