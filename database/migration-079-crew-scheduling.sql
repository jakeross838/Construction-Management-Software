-- Migration 079: Crew Scheduling
-- Work requests, crew members, and scheduling

-- Crew members (links to contacts)
CREATE TABLE IF NOT EXISTS v2_crew_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES v2_contacts(id),
  name TEXT NOT NULL,
  role TEXT, -- foreman, carpenter, laborer, electrician, plumber, etc.
  skills TEXT[], -- array of skills
  hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Work requests from PMs
CREATE TABLE IF NOT EXISTS v2_work_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id),
  requested_by TEXT, -- PM name
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  estimated_hours DECIMAL(5,2),
  required_skills TEXT[], -- skills needed
  preferred_date DATE, -- when PM wants it done
  due_date DATE, -- hard deadline
  status TEXT DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
  assigned_crew_id UUID REFERENCES v2_crew_members(id),
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Crew availability
CREATE TABLE IF NOT EXISTS v2_crew_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES v2_crew_members(id),
  date DATE NOT NULL,
  start_time TIME DEFAULT '07:00',
  end_time TIME DEFAULT '17:00',
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crew_id, date)
);

-- Scheduled work (calendar entries)
CREATE TABLE IF NOT EXISTS v2_crew_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES v2_crew_members(id),
  work_request_id UUID REFERENCES v2_work_requests(id),
  job_id UUID REFERENCES v2_jobs(id),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  actual_hours DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for crew scheduling
CREATE INDEX IF NOT EXISTS idx_crew_members_active ON v2_crew_members(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crew_members_contact ON v2_crew_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_job ON v2_work_requests(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON v2_work_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_requests_scheduled ON v2_work_requests(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crew_availability_date ON v2_crew_availability(date);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_crew ON v2_crew_schedules(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_date ON v2_crew_schedules(date);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_job ON v2_crew_schedules(job_id);
