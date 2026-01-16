-- Migration 036: Expanded Job Specifications
-- Comprehensive specs for budgeting, scheduling, and historical analysis

-- ============================================================
-- STRUCTURAL SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS struct_foundation_depth INTEGER,          -- inches
ADD COLUMN IF NOT EXISTS struct_foundation_width INTEGER,          -- inches
ADD COLUMN IF NOT EXISTS struct_pier_count INTEGER,
ADD COLUMN IF NOT EXISTS struct_pier_depth INTEGER,                -- feet
ADD COLUMN IF NOT EXISTS struct_pier_diameter INTEGER,             -- inches
ADD COLUMN IF NOT EXISTS struct_concrete_psi INTEGER,              -- concrete strength
ADD COLUMN IF NOT EXISTS struct_concrete_yards DECIMAL(6,1),       -- estimated CY
ADD COLUMN IF NOT EXISTS struct_rebar_tons DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS struct_steel_beams INTEGER,               -- count
ADD COLUMN IF NOT EXISTS struct_steel_columns INTEGER,             -- count
ADD COLUMN IF NOT EXISTS struct_steel_tonnage DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS struct_wood_beam_count INTEGER,
ADD COLUMN IF NOT EXISTS struct_lvl_beam_count INTEGER,
ADD COLUMN IF NOT EXISTS struct_truss_count INTEGER,
ADD COLUMN IF NOT EXISTS struct_truss_span_max INTEGER,            -- feet
ADD COLUMN IF NOT EXISTS struct_roof_pitch TEXT,                   -- e.g., "4:12"
ADD COLUMN IF NOT EXISTS struct_wall_framing TEXT,                 -- 2x4, 2x6, etc.
ADD COLUMN IF NOT EXISTS struct_sheathing_type TEXT,               -- OSB, plywood, etc.
ADD COLUMN IF NOT EXISTS struct_wind_speed INTEGER,                -- mph design wind speed
ADD COLUMN IF NOT EXISTS struct_exposure_category TEXT,            -- B, C, D
ADD COLUMN IF NOT EXISTS struct_seismic_category TEXT,
ADD COLUMN IF NOT EXISTS struct_live_load_floor INTEGER,           -- PSF
ADD COLUMN IF NOT EXISTS struct_live_load_roof INTEGER,            -- PSF
ADD COLUMN IF NOT EXISTS struct_notes TEXT;

-- ============================================================
-- WINDOW & DOOR SCHEDULES
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS windows_total_count INTEGER,
ADD COLUMN IF NOT EXISTS windows_impact_rated BOOLEAN,
ADD COLUMN IF NOT EXISTS windows_manufacturer TEXT,
ADD COLUMN IF NOT EXISTS windows_frame_material TEXT,              -- aluminum, vinyl, wood
ADD COLUMN IF NOT EXISTS windows_glass_type TEXT,                  -- single, double, triple, low-e
ADD COLUMN IF NOT EXISTS windows_total_sqft DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS windows_schedule JSONB,                   -- detailed window schedule

ADD COLUMN IF NOT EXISTS doors_exterior_count INTEGER,
ADD COLUMN IF NOT EXISTS doors_interior_count INTEGER,
ADD COLUMN IF NOT EXISTS doors_garage_count INTEGER,
ADD COLUMN IF NOT EXISTS doors_garage_width INTEGER,               -- total feet
ADD COLUMN IF NOT EXISTS doors_impact_rated BOOLEAN,
ADD COLUMN IF NOT EXISTS doors_manufacturer TEXT,
ADD COLUMN IF NOT EXISTS doors_schedule JSONB;                     -- detailed door schedule

-- ============================================================
-- ROOM DETAILS & FINISHES
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS rooms_schedule JSONB,                     -- [{name, sqft, ceiling_height, flooring, etc}]
ADD COLUMN IF NOT EXISTS ceiling_height_main DECIMAL(4,1),         -- feet
ADD COLUMN IF NOT EXISTS ceiling_height_max DECIMAL(4,1),          -- feet (vaulted)
ADD COLUMN IF NOT EXISTS flooring_tile_sqft INTEGER,
ADD COLUMN IF NOT EXISTS flooring_wood_sqft INTEGER,
ADD COLUMN IF NOT EXISTS flooring_carpet_sqft INTEGER,
ADD COLUMN IF NOT EXISTS flooring_other_sqft INTEGER,
ADD COLUMN IF NOT EXISTS countertop_material TEXT,
ADD COLUMN IF NOT EXISTS countertop_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS cabinet_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS fireplace_count INTEGER,
ADD COLUMN IF NOT EXISTS fireplace_type TEXT;                      -- gas, wood, electric

-- ============================================================
-- PLUMBING SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS plumb_fixtures_total INTEGER,
ADD COLUMN IF NOT EXISTS plumb_toilets INTEGER,
ADD COLUMN IF NOT EXISTS plumb_sinks INTEGER,
ADD COLUMN IF NOT EXISTS plumb_showers INTEGER,
ADD COLUMN IF NOT EXISTS plumb_tubs INTEGER,
ADD COLUMN IF NOT EXISTS plumb_water_heater_type TEXT,             -- tank, tankless
ADD COLUMN IF NOT EXISTS plumb_water_heater_gallons INTEGER,
ADD COLUMN IF NOT EXISTS plumb_water_heater_count INTEGER,
ADD COLUMN IF NOT EXISTS plumb_gas_line BOOLEAN,
ADD COLUMN IF NOT EXISTS plumb_water_source TEXT,                  -- city, well
ADD COLUMN IF NOT EXISTS plumb_sewer_type TEXT,                    -- city, septic
ADD COLUMN IF NOT EXISTS plumb_pipe_material TEXT,                 -- PEX, copper, CPVC
ADD COLUMN IF NOT EXISTS plumb_hose_bibs INTEGER,
ADD COLUMN IF NOT EXISTS plumb_notes TEXT;

-- ============================================================
-- ELECTRICAL SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS elec_service_amps INTEGER,                -- 200, 400, etc.
ADD COLUMN IF NOT EXISTS elec_panel_count INTEGER,
ADD COLUMN IF NOT EXISTS elec_circuits_count INTEGER,
ADD COLUMN IF NOT EXISTS elec_outlets_count INTEGER,
ADD COLUMN IF NOT EXISTS elec_switches_count INTEGER,
ADD COLUMN IF NOT EXISTS elec_lighting_fixtures INTEGER,
ADD COLUMN IF NOT EXISTS elec_recessed_lights INTEGER,
ADD COLUMN IF NOT EXISTS elec_ceiling_fans INTEGER,
ADD COLUMN IF NOT EXISTS elec_240v_circuits INTEGER,               -- for appliances
ADD COLUMN IF NOT EXISTS elec_gfci_locations INTEGER,
ADD COLUMN IF NOT EXISTS elec_smoke_detectors INTEGER,
ADD COLUMN IF NOT EXISTS elec_generator_ready BOOLEAN,
ADD COLUMN IF NOT EXISTS elec_solar_ready BOOLEAN,
ADD COLUMN IF NOT EXISTS elec_ev_charger_ready BOOLEAN,
ADD COLUMN IF NOT EXISTS elec_low_voltage_runs INTEGER,            -- data/cable
ADD COLUMN IF NOT EXISTS elec_notes TEXT;

-- ============================================================
-- HVAC SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS hvac_system_type TEXT,                    -- split, package, mini-split
ADD COLUMN IF NOT EXISTS hvac_fuel_type TEXT,                      -- electric, gas, heat pump
ADD COLUMN IF NOT EXISTS hvac_zones INTEGER,
ADD COLUMN IF NOT EXISTS hvac_duct_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS hvac_return_count INTEGER,
ADD COLUMN IF NOT EXISTS hvac_supply_count INTEGER,
ADD COLUMN IF NOT EXISTS hvac_thermostat_count INTEGER,
ADD COLUMN IF NOT EXISTS hvac_filter_size TEXT,
ADD COLUMN IF NOT EXISTS hvac_seer_rating DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS hvac_notes TEXT;

-- ============================================================
-- EXTERIOR & SITE
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS ext_siding_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_stucco_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_brick_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_stone_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_soffit_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS ext_fascia_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS ext_gutter_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS ext_driveway_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_driveway_material TEXT,
ADD COLUMN IF NOT EXISTS ext_sidewalk_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_patio_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_deck_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_fence_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS ext_fence_type TEXT,
ADD COLUMN IF NOT EXISTS ext_retaining_wall_ft INTEGER,
ADD COLUMN IF NOT EXISTS ext_irrigation_zones INTEGER,
ADD COLUMN IF NOT EXISTS ext_pool_sqft INTEGER,
ADD COLUMN IF NOT EXISTS ext_pool_equipment TEXT,
ADD COLUMN IF NOT EXISTS ext_notes TEXT;

-- ============================================================
-- ROOFING SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS roof_sqft INTEGER,                        -- total roof area
ADD COLUMN IF NOT EXISTS roof_squares DECIMAL(5,1),                -- roofing squares
ADD COLUMN IF NOT EXISTS roof_material TEXT,                       -- shingle type, tile type
ADD COLUMN IF NOT EXISTS roof_manufacturer TEXT,
ADD COLUMN IF NOT EXISTS roof_warranty_years INTEGER,
ADD COLUMN IF NOT EXISTS roof_underlayment TEXT,
ADD COLUMN IF NOT EXISTS roof_valleys_count INTEGER,
ADD COLUMN IF NOT EXISTS roof_hips_ridges_ft INTEGER,
ADD COLUMN IF NOT EXISTS roof_penetrations INTEGER,                -- vents, pipes, etc.
ADD COLUMN IF NOT EXISTS roof_skylights INTEGER,
ADD COLUMN IF NOT EXISTS roof_notes TEXT;

-- ============================================================
-- INSULATION SPECIFICATIONS
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS insul_wall_type TEXT,                     -- batt, spray foam, etc.
ADD COLUMN IF NOT EXISTS insul_wall_r_value DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS insul_ceiling_type TEXT,
ADD COLUMN IF NOT EXISTS insul_ceiling_r_value DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS insul_floor_type TEXT,
ADD COLUMN IF NOT EXISTS insul_floor_r_value DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS insul_notes TEXT;

-- ============================================================
-- APPLIANCES & EQUIPMENT
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS appl_range_type TEXT,                     -- gas, electric, induction
ADD COLUMN IF NOT EXISTS appl_oven_type TEXT,                      -- single, double, wall
ADD COLUMN IF NOT EXISTS appl_cooktop BOOLEAN,
ADD COLUMN IF NOT EXISTS appl_vent_hood_type TEXT,
ADD COLUMN IF NOT EXISTS appl_refrigerator_type TEXT,
ADD COLUMN IF NOT EXISTS appl_dishwasher BOOLEAN,
ADD COLUMN IF NOT EXISTS appl_disposal BOOLEAN,
ADD COLUMN IF NOT EXISTS appl_microwave_type TEXT,                 -- built-in, OTR
ADD COLUMN IF NOT EXISTS appl_washer_dryer_hookup BOOLEAN,
ADD COLUMN IF NOT EXISTS appl_washer_dryer_gas BOOLEAN,
ADD COLUMN IF NOT EXISTS appl_notes TEXT;

-- ============================================================
-- CODE & PERMIT INFO
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS code_building_code TEXT,                  -- FBC 7th, IRC 2021, etc.
ADD COLUMN IF NOT EXISTS code_energy_code TEXT,
ADD COLUMN IF NOT EXISTS code_occupancy_type TEXT,                 -- R-3, etc.
ADD COLUMN IF NOT EXISTS code_construction_type TEXT,              -- Type V-B, etc.
ADD COLUMN IF NOT EXISTS code_fire_sprinklers BOOLEAN,
ADD COLUMN IF NOT EXISTS code_ada_required BOOLEAN,
ADD COLUMN IF NOT EXISTS setback_front INTEGER,                    -- feet
ADD COLUMN IF NOT EXISTS setback_rear INTEGER,
ADD COLUMN IF NOT EXISTS setback_left INTEGER,
ADD COLUMN IF NOT EXISTS setback_right INTEGER,
ADD COLUMN IF NOT EXISTS lot_coverage_allowed DECIMAL(5,2),        -- percentage
ADD COLUMN IF NOT EXISTS lot_coverage_actual DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS height_limit INTEGER,                     -- feet
ADD COLUMN IF NOT EXISTS height_actual INTEGER;

-- ============================================================
-- PROJECT TEAM
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS team_architect_firm TEXT,
ADD COLUMN IF NOT EXISTS team_architect_phone TEXT,
ADD COLUMN IF NOT EXISTS team_architect_license TEXT,
ADD COLUMN IF NOT EXISTS team_engineer_firm TEXT,
ADD COLUMN IF NOT EXISTS team_engineer_phone TEXT,
ADD COLUMN IF NOT EXISTS team_engineer_license TEXT,
ADD COLUMN IF NOT EXISTS team_surveyor TEXT,
ADD COLUMN IF NOT EXISTS team_geotech TEXT,
ADD COLUMN IF NOT EXISTS team_interior_designer TEXT;

-- ============================================================
-- MATERIAL QUANTITIES (for budgeting)
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS mat_framing_bf INTEGER,                   -- board feet lumber
ADD COLUMN IF NOT EXISTS mat_drywall_sheets INTEGER,
ADD COLUMN IF NOT EXISTS mat_drywall_sqft INTEGER,
ADD COLUMN IF NOT EXISTS mat_paint_sqft INTEGER,
ADD COLUMN IF NOT EXISTS mat_trim_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS mat_baseboard_linear_ft INTEGER,
ADD COLUMN IF NOT EXISTS mat_crown_linear_ft INTEGER;

-- ============================================================
-- EXTRACTED SCHEDULES (JSONB for flexibility)
-- ============================================================
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS schedule_windows JSONB,                   -- full window schedule
ADD COLUMN IF NOT EXISTS schedule_doors JSONB,                     -- full door schedule
ADD COLUMN IF NOT EXISTS schedule_rooms JSONB,                     -- room finish schedule
ADD COLUMN IF NOT EXISTS schedule_fixtures JSONB,                  -- plumbing fixture schedule
ADD COLUMN IF NOT EXISTS schedule_electrical JSONB,                -- electrical panel schedule
ADD COLUMN IF NOT EXISTS schedule_equipment JSONB,                 -- mechanical equipment
ADD COLUMN IF NOT EXISTS extracted_notes_arch TEXT,                -- AI notes from arch plans
ADD COLUMN IF NOT EXISTS extracted_notes_struct TEXT,              -- AI notes from struct plans
ADD COLUMN IF NOT EXISTS extracted_notes_mep TEXT;                 -- AI notes from MEP plans

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_sqft ON v2_jobs(sqft_conditioned);
CREATE INDEX IF NOT EXISTS idx_jobs_stories ON v2_jobs(stories);
CREATE INDEX IF NOT EXISTS idx_jobs_construction_type ON v2_jobs(construction_type);
