-- Create employees table for team member management
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  role VARCHAR,
  department VARCHAR,
  hourly_rate NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Employees are viewable by everyone" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Employees can be inserted by anyone" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Employees can be updated by anyone" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Employees can be deleted by anyone" ON public.employees FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for active employees
CREATE INDEX idx_employees_is_active ON public.employees(is_active);

-- Update schedule_tasks to reference employees
ALTER TABLE public.schedule_tasks 
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.employees(id);

CREATE INDEX IF NOT EXISTS idx_schedule_tasks_assigned_employee ON public.schedule_tasks(assigned_employee_id);