-- Add comprehensive job details columns to jobs table

-- Client Information
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_email VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_phone VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_cell VARCHAR;

-- Property Details
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS square_footage INTEGER;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS stories INTEGER DEFAULT 1;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bathrooms NUMERIC;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS half_baths INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS garage_spaces INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lot_size NUMERIC;

-- Structure Details
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS architectural_style VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS foundation_type VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS roof_type VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS exterior_finish VARCHAR;

-- Systems
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hvac_system VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS electrical_service VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS plumbing_type VARCHAR;

-- Features (stored as array)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS premium_features TEXT[];

-- Team
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS project_manager VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS site_supervisor VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS architect VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS engineer VARCHAR;

-- Additional Job Info
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS permit_number VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS parcel_id VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS flood_zone VARCHAR;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS year_built INTEGER;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS construction_type VARCHAR;