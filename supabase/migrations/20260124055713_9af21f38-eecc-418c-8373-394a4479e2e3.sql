
-- Daily Logs main table
CREATE TABLE public.daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  
  -- Weather
  weather_conditions VARCHAR CHECK (weather_conditions IN ('sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy', 'windy', 'snow')),
  temperature_high INTEGER,
  temperature_low INTEGER,
  weather_notes TEXT,
  
  -- Construction phase
  construction_phase VARCHAR,
  
  -- Yesterday's plan tracking
  plan_completed VARCHAR CHECK (plan_completed IN ('yes', 'partial', 'no')),
  plan_variance_notes TEXT,
  
  -- Work summary
  work_completed TEXT,
  work_planned TEXT,
  delays_issues TEXT,
  site_visitors TEXT,
  safety_notes TEXT,
  
  -- Dumpster tracking
  dumpster_exchange BOOLEAN DEFAULT false,
  
  -- Absent crews (JSONB array)
  absent_crews JSONB DEFAULT '[]',
  
  -- Metadata
  created_by VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- One log per job per day
  UNIQUE(job_id, log_date)
);

-- Enable RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily logs are viewable by everyone" ON public.daily_logs FOR SELECT USING (true);
CREATE POLICY "Daily logs can be inserted by anyone" ON public.daily_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Daily logs can be updated by anyone" ON public.daily_logs FOR UPDATE USING (true);
CREATE POLICY "Daily logs can be deleted by anyone" ON public.daily_logs FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Log Crew table
CREATE TABLE public.daily_log_crew (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id),
  worker_count INTEGER DEFAULT 1,
  hours_worked DECIMAL(5,2),
  trade VARCHAR,
  work_area TEXT,
  completion_percent INTEGER CHECK (completion_percent >= 0 AND completion_percent <= 100),
  po_id UUID REFERENCES public.purchase_orders(id),
  schedule_task_id UUID REFERENCES public.schedule_tasks(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_log_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily log crew are viewable by everyone" ON public.daily_log_crew FOR SELECT USING (true);
CREATE POLICY "Daily log crew can be inserted by anyone" ON public.daily_log_crew FOR INSERT WITH CHECK (true);
CREATE POLICY "Daily log crew can be updated by anyone" ON public.daily_log_crew FOR UPDATE USING (true);
CREATE POLICY "Daily log crew can be deleted by anyone" ON public.daily_log_crew FOR DELETE USING (true);

CREATE TRIGGER update_daily_log_crew_updated_at
  BEFORE UPDATE ON public.daily_log_crew
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Log Deliveries table
CREATE TABLE public.daily_log_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit VARCHAR,
  received_by VARCHAR,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_log_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily log deliveries are viewable by everyone" ON public.daily_log_deliveries FOR SELECT USING (true);
CREATE POLICY "Daily log deliveries can be inserted by anyone" ON public.daily_log_deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "Daily log deliveries can be updated by anyone" ON public.daily_log_deliveries FOR UPDATE USING (true);
CREATE POLICY "Daily log deliveries can be deleted by anyone" ON public.daily_log_deliveries FOR DELETE USING (true);

CREATE TRIGGER update_daily_log_deliveries_updated_at
  BEFORE UPDATE ON public.daily_log_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Log Inspections table
CREATE TABLE public.daily_log_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  inspection_type VARCHAR NOT NULL,
  result VARCHAR NOT NULL DEFAULT 'scheduled' CHECK (result IN ('scheduled', 'passed', 'failed', 'partial')),
  inspector VARCHAR,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_log_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily log inspections are viewable by everyone" ON public.daily_log_inspections FOR SELECT USING (true);
CREATE POLICY "Daily log inspections can be inserted by anyone" ON public.daily_log_inspections FOR INSERT WITH CHECK (true);
CREATE POLICY "Daily log inspections can be updated by anyone" ON public.daily_log_inspections FOR UPDATE USING (true);
CREATE POLICY "Daily log inspections can be deleted by anyone" ON public.daily_log_inspections FOR DELETE USING (true);

CREATE TRIGGER update_daily_log_inspections_updated_at
  BEFORE UPDATE ON public.daily_log_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Log Attachments (Photos) table
CREATE TABLE public.daily_log_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR NOT NULL,
  file_type VARCHAR,
  file_size INTEGER,
  caption TEXT,
  category VARCHAR DEFAULT 'progress' CHECK (category IN ('progress', 'delivery', 'safety', 'inspection', 'other')),
  uploaded_by VARCHAR,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_log_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily log attachments are viewable by everyone" ON public.daily_log_attachments FOR SELECT USING (true);
CREATE POLICY "Daily log attachments can be inserted by anyone" ON public.daily_log_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Daily log attachments can be updated by anyone" ON public.daily_log_attachments FOR UPDATE USING (true);
CREATE POLICY "Daily log attachments can be deleted by anyone" ON public.daily_log_attachments FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_daily_logs_job_id ON public.daily_logs(job_id);
CREATE INDEX idx_daily_logs_log_date ON public.daily_logs(log_date);
CREATE INDEX idx_daily_logs_status ON public.daily_logs(status);
CREATE INDEX idx_daily_log_crew_daily_log_id ON public.daily_log_crew(daily_log_id);
CREATE INDEX idx_daily_log_deliveries_daily_log_id ON public.daily_log_deliveries(daily_log_id);
CREATE INDEX idx_daily_log_inspections_daily_log_id ON public.daily_log_inspections(daily_log_id);
CREATE INDEX idx_daily_log_attachments_daily_log_id ON public.daily_log_attachments(daily_log_id);
