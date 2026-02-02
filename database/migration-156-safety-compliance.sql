-- Migration 156: Safety & Compliance System
-- OSHA log 300, incident reporting, safety meetings, and toolbox talk templates

-- ============================================================
-- TOOLBOX TALK TEMPLATES (must create first for FK reference)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_toolbox_talk_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Template details
  title TEXT NOT NULL,
  category TEXT,  -- fall_protection, electrical, scaffolding, excavation, ppe, etc.
  content TEXT,   -- Full talk content/script
  duration_minutes INTEGER DEFAULT 15,

  -- Safety specifics
  required_ppe JSONB DEFAULT '[]',        -- ["hard_hat", "safety_glasses", "gloves"]
  hazards_covered JSONB DEFAULT '[]',     -- ["falls", "electrical", "struck_by"]

  -- Template ownership
  is_default BOOLEAN DEFAULT FALSE,       -- System-provided templates

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY INCIDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Incident details
  incident_date DATE NOT NULL,
  incident_time TIME,
  location TEXT,                          -- Specific location on job site
  description TEXT NOT NULL,

  -- Classification
  incident_type TEXT NOT NULL CHECK (incident_type IN ('injury', 'near_miss', 'property_damage', 'environmental')),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'serious', 'critical')),

  -- Injured party (for injury type)
  injured_person_name TEXT,
  injured_person_role TEXT,               -- employee, subcontractor, visitor

  -- Witnesses
  witness_names JSONB DEFAULT '[]',       -- ["John Smith", "Jane Doe"]

  -- Response and resolution
  immediate_actions TEXT,                 -- Actions taken immediately after incident
  root_cause TEXT,                        -- Root cause analysis
  corrective_actions TEXT,                -- Corrective actions to prevent recurrence

  -- OSHA reporting (for recordable injuries)
  reported_to_osha BOOLEAN DEFAULT FALSE,
  osha_case_number TEXT,
  days_away INTEGER DEFAULT 0,            -- Days away from work
  days_restricted INTEGER DEFAULT 0,      -- Days on restricted duty

  -- Workflow
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'closed')),

  -- Audit
  reported_by TEXT NOT NULL,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY MEETINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_safety_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Meeting details
  meeting_date DATE NOT NULL,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('daily_huddle', 'weekly', 'monthly', 'toolbox_talk')),
  topic TEXT,
  template_id UUID REFERENCES v2_toolbox_talk_templates(id) ON DELETE SET NULL,

  -- Attendance
  attendees JSONB DEFAULT '[]',           -- [{"name": "John", "role": "foreman", "signed": true}]
  sign_in_sheet_url TEXT,                 -- Uploaded sign-in sheet

  -- Content
  notes TEXT,
  hazards_discussed JSONB DEFAULT '[]',   -- Hazards discussed in meeting
  action_items JSONB DEFAULT '[]',        -- Follow-up items

  -- Audit
  conducted_by TEXT NOT NULL,
  duration_minutes INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY INCIDENT ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_safety_incident_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES v2_safety_incidents(id) ON DELETE CASCADE,

  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  description TEXT,
  category TEXT DEFAULT 'photo',          -- photo, document, form

  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY INCIDENT ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_safety_incident_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES v2_safety_incidents(id) ON DELETE CASCADE,

  action TEXT NOT NULL,                   -- created, updated, status_changed, osha_reported, closed
  performed_by TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Incidents
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_builder ON v2_safety_incidents(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_job ON v2_safety_incidents(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_date ON v2_safety_incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_type ON v2_safety_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_status ON v2_safety_incidents(status);
CREATE INDEX IF NOT EXISTS idx_v2_safety_incidents_osha ON v2_safety_incidents(reported_to_osha) WHERE reported_to_osha = TRUE;

-- Meetings
CREATE INDEX IF NOT EXISTS idx_v2_safety_meetings_builder ON v2_safety_meetings(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_safety_meetings_job ON v2_safety_meetings(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_safety_meetings_date ON v2_safety_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_v2_safety_meetings_type ON v2_safety_meetings(meeting_type);

-- Templates
CREATE INDEX IF NOT EXISTS idx_v2_toolbox_templates_builder ON v2_toolbox_talk_templates(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_toolbox_templates_category ON v2_toolbox_talk_templates(category);

-- Attachments
CREATE INDEX IF NOT EXISTS idx_v2_safety_attachments_incident ON v2_safety_incident_attachments(incident_id);

-- Activity
CREATE INDEX IF NOT EXISTS idx_v2_safety_activity_incident ON v2_safety_incident_activity(incident_id);

-- ============================================================
-- SEED DEFAULT TOOLBOX TALK TEMPLATES
-- ============================================================

INSERT INTO v2_toolbox_talk_templates (title, category, content, duration_minutes, required_ppe, hazards_covered, is_default)
VALUES
  (
    'Fall Protection Basics',
    'fall_protection',
    E'## Fall Protection Basics\n\n### Key Points:\n1. **100% Tie-Off Policy**: Always maintain 100% tie-off when working at heights of 6 feet or more.\n2. **Inspect Your Equipment**: Check harnesses, lanyards, and anchor points before each use.\n3. **Proper Anchor Points**: Use anchor points rated for 5,000 lbs per worker attached.\n4. **Guardrails**: Ensure guardrails are in place around floor openings and edges.\n5. **Ladder Safety**: Maintain 3 points of contact. Never carry tools while climbing.\n\n### Discussion Questions:\n- What fall hazards exist on our current jobsite?\n- When was the last time you inspected your fall protection equipment?\n- What should you do if you notice a damaged harness?',
    15,
    '["hard_hat", "safety_harness", "safety_glasses", "work_boots"]',
    '["falls", "heights", "ladders"]',
    TRUE
  ),
  (
    'Electrical Safety',
    'electrical',
    E'## Electrical Safety\n\n### Key Points:\n1. **Lockout/Tagout**: Always de-energize and lock out circuits before working.\n2. **Assume Live**: Treat all electrical equipment as energized until verified.\n3. **GFCIs**: Use Ground Fault Circuit Interrupters for all temporary power.\n4. **Damaged Cords**: Remove damaged extension cords from service immediately.\n5. **Clearances**: Maintain safe distances from overhead power lines.\n\n### Discussion Questions:\n- Who is qualified to work on electrical systems?\n- What is the minimum clearance from power lines for our equipment?\n- Where are the emergency shutoffs located on this site?',
    15,
    '["hard_hat", "safety_glasses", "insulated_gloves"]',
    '["electrical", "shock", "arc_flash"]',
    TRUE
  ),
  (
    'Scaffolding Safety',
    'scaffolding',
    E'## Scaffolding Safety\n\n### Key Points:\n1. **Competent Person**: Only a competent person can erect, modify, or dismantle scaffolding.\n2. **Inspection**: Inspect scaffolding before each work shift.\n3. **Guardrails**: All scaffolds over 10 feet must have guardrails, midrails, and toeboards.\n4. **Planking**: Scaffold planks must be scaffold-grade and span no more than their rated capacity.\n5. **Access**: Use proper ladders or stair towers to access scaffolds - never climb cross braces.\n\n### Discussion Questions:\n- Who is the competent person for scaffolding on this site?\n- What defects would cause you to not use a scaffold?\n- How should materials be stored on scaffolding?',
    15,
    '["hard_hat", "safety_glasses", "work_boots", "safety_harness"]',
    '["falls", "scaffolding", "struck_by"]',
    TRUE
  ),
  (
    'Excavation and Trenching',
    'excavation',
    E'## Excavation and Trenching Safety\n\n### Key Points:\n1. **Utility Location**: Call 811 before any excavation. Wait for all utilities to be marked.\n2. **Protective Systems**: Trenches 5 feet or deeper require cave-in protection.\n3. **Competent Person**: Must inspect trenches daily and after any event that could affect stability.\n4. **Egress**: Provide ladder, ramp, or stairway within 25 feet of all workers in trenches.\n5. **Spoil Piles**: Keep excavated material at least 2 feet from trench edges.\n\n### Discussion Questions:\n- What types of protective systems are used on this site?\n- What soil conditions affect trench stability?\n- What are the signs of an unstable trench wall?',
    15,
    '["hard_hat", "safety_glasses", "safety_vest", "work_boots"]',
    '["cave_in", "excavation", "utility_strike"]',
    TRUE
  ),
  (
    'Personal Protective Equipment (PPE)',
    'ppe',
    E'## Personal Protective Equipment (PPE)\n\n### Key Points:\n1. **Hard Hats**: Required at all times on the construction site.\n2. **Eye Protection**: Safety glasses or goggles for all activities with flying debris.\n3. **Hearing Protection**: Required when noise levels exceed 85 dB.\n4. **Hand Protection**: Select gloves appropriate for the task (cut-resistant, chemical, etc.).\n5. **Foot Protection**: Steel-toed or composite-toed boots required on site.\n\n### PPE Inspection:\n- Check for cracks, damage, or wear before each use\n- Replace damaged PPE immediately\n- Ensure proper fit\n\n### Discussion Questions:\n- What PPE is required for your specific task today?\n- When was your hard hat last replaced?\n- What additional PPE might be needed for specialty tasks?',
    10,
    '["hard_hat", "safety_glasses", "work_boots"]',
    '["head_injury", "eye_injury", "hearing_loss", "hand_injury"]',
    TRUE
  ),
  (
    'Heat Illness Prevention',
    'environmental',
    E'## Heat Illness Prevention\n\n### Key Points:\n1. **Hydration**: Drink water every 15-20 minutes - don''t wait until you''re thirsty.\n2. **Rest Breaks**: Take breaks in shaded or air-conditioned areas.\n3. **Acclimatization**: New workers need time to adjust to heat (build up gradually).\n4. **Buddy System**: Watch coworkers for signs of heat illness.\n5. **Warning Signs**: Headache, nausea, dizziness, confusion, rapid heartbeat.\n\n### Emergency Response:\n- Move person to cool area immediately\n- Apply cool water to skin\n- Call 911 if symptoms are severe\n\n### Discussion Questions:\n- Where are the water coolers and shade structures located?\n- What are today''s heat index predictions?\n- Who should you notify if you feel symptoms of heat illness?',
    10,
    '["hard_hat", "safety_glasses", "light_clothing"]',
    '["heat_stroke", "heat_exhaustion", "dehydration"]',
    TRUE
  ),
  (
    'Hand and Power Tool Safety',
    'tools',
    E'## Hand and Power Tool Safety\n\n### Key Points:\n1. **Right Tool**: Always use the right tool for the job.\n2. **Inspection**: Inspect tools before each use - damaged tools must be removed from service.\n3. **Guards**: Never remove or bypass safety guards on power tools.\n4. **Disconnect**: Unplug or lock out tools before changing blades or bits.\n5. **Storage**: Store tools properly when not in use.\n\n### Common Hazards:\n- Flying debris from cutting/grinding\n- Entanglement with rotating parts\n- Electric shock from damaged cords\n- Kickback from saws\n\n### Discussion Questions:\n- What tools will you be using today?\n- Where should damaged tools be reported?\n- What PPE is required for the tools you''re using?',
    15,
    '["hard_hat", "safety_glasses", "gloves", "hearing_protection"]',
    '["cuts", "amputations", "eye_injury", "electrical"]',
    TRUE
  ),
  (
    'Fire Prevention and Extinguisher Use',
    'fire_safety',
    E'## Fire Prevention and Extinguisher Use\n\n### Key Points:\n1. **Hot Work Permits**: Required for welding, cutting, or other spark-producing work.\n2. **Fire Watch**: Post fire watch during and 30 minutes after hot work.\n3. **Housekeeping**: Keep combustible materials away from ignition sources.\n4. **Extinguisher Locations**: Know where fire extinguishers are located.\n5. **PASS Method**: Pull pin, Aim low, Squeeze handle, Sweep side to side.\n\n### Types of Fires:\n- Class A: Ordinary combustibles (wood, paper)\n- Class B: Flammable liquids\n- Class C: Electrical\n- Class D: Combustible metals\n\n### Discussion Questions:\n- Where are the nearest fire extinguishers?\n- What is the evacuation plan for this site?\n- What hot work is planned for today?',
    15,
    '["hard_hat", "safety_glasses", "fire_resistant_clothing"]',
    '["fire", "burns", "smoke_inhalation"]',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_safety_incidents IS 'Safety incidents including injuries, near misses, property damage, and environmental incidents. Supports OSHA 300 log generation.';
COMMENT ON TABLE v2_safety_meetings IS 'Safety meetings including daily huddles, weekly meetings, and toolbox talks with attendance tracking.';
COMMENT ON TABLE v2_toolbox_talk_templates IS 'Templates for toolbox talks with predefined content, PPE requirements, and hazards covered.';

COMMENT ON COLUMN v2_safety_incidents.days_away IS 'OSHA metric: Total days away from work due to injury';
COMMENT ON COLUMN v2_safety_incidents.days_restricted IS 'OSHA metric: Total days on restricted duty due to injury';
COMMENT ON COLUMN v2_safety_incidents.osha_case_number IS 'OSHA case number for recordable injuries';
