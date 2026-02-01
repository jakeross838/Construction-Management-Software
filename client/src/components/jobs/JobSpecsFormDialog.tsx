import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Building2, Zap, Droplets, Wind, Home, Hammer, PaintBucket, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Job,
  useUpdateJobSpecs,
  foundationTypeOptions,
  roofTypeOptions,
  exteriorFinishOptions,
  poolTypeOptions,
  hvacSystemOptions,
  hvacFuelOptions,
  waterHeaterOptions,
  windowFrameOptions,
  windowGlassOptions,
  pipeMaterialOptions,
  insulationTypeOptions,
  countertopOptions,
} from '@/hooks/useJobs';

interface JobSpecsFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

// Helper component for consistent form field styling
function FormField({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Number input that handles empty strings properly
function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  step,
  className = '',
}: {
  value: number | string | undefined | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  min?: number;
  step?: string;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '' ? null : parseFloat(val));
      }}
      placeholder={placeholder}
      min={min}
      step={step}
      className={className}
    />
  );
}

// Select with empty option handling
function SpecSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  value: string | undefined | null;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value || '_none_'}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function JobSpecsFormDialog({ open, onOpenChange, job }: JobSpecsFormDialogProps) {
  const updateSpecs = useUpdateJobSpecs();
  const [specs, setSpecs] = useState<Record<string, any>>({});
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);

  // Initialize specs from job data
  useEffect(() => {
    if (job && open) {
      setSpecs({ ...job });
    }
  }, [job, open]);

  const updateField = (field: string, value: any) => {
    setSpecs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      // Filter out non-spec fields and unchanged values
      const specsToUpdate: Record<string, any> = {};
      const specFields = [
        // Basic building
        'sqft_conditioned', 'sqft_total', 'sqft_garage', 'sqft_covered',
        'lot_size_sqft', 'lot_size_acres', 'bedrooms', 'bathrooms', 'half_baths',
        'stories', 'garage_spaces', 'ac_units', 'ac_tonnage', 'pool_type',
        'construction_type', 'foundation_type', 'roof_type', 'exterior_finish',
        'year_built', 'zoning', 'flood_zone', 'parcel_id', 'legal_description',
        'architect', 'engineer', 'permit_number', 'permit_date',
        'estimated_start', 'estimated_completion', 'actual_start', 'actual_completion',
        'specs_notes',
        // Structural
        'struct_foundation_depth', 'struct_foundation_width', 'struct_pier_count',
        'struct_pier_depth', 'struct_pier_diameter', 'struct_concrete_psi',
        'struct_concrete_yards', 'struct_rebar_tons', 'struct_steel_beams',
        'struct_steel_columns', 'struct_steel_tonnage', 'struct_wood_beam_count',
        'struct_lvl_beam_count', 'struct_truss_count', 'struct_truss_span_max',
        'struct_roof_pitch', 'struct_wall_framing', 'struct_sheathing_type',
        'struct_wind_speed', 'struct_exposure_category', 'struct_seismic_category',
        'struct_live_load_floor', 'struct_live_load_roof', 'struct_notes',
        // Windows & Doors
        'windows_total_count', 'windows_impact_rated', 'windows_manufacturer',
        'windows_frame_material', 'windows_glass_type', 'windows_total_sqft',
        'doors_exterior_count', 'doors_interior_count', 'doors_garage_count',
        'doors_garage_width', 'doors_impact_rated', 'doors_manufacturer',
        // Room details
        'ceiling_height_main', 'ceiling_height_max',
        'flooring_tile_sqft', 'flooring_wood_sqft', 'flooring_carpet_sqft', 'flooring_other_sqft',
        'countertop_material', 'countertop_linear_ft', 'cabinet_linear_ft',
        'fireplace_count', 'fireplace_type',
        // Plumbing
        'plumb_fixtures_total', 'plumb_toilets', 'plumb_sinks', 'plumb_showers', 'plumb_tubs',
        'plumb_water_heater_type', 'plumb_water_heater_gallons', 'plumb_water_heater_count',
        'plumb_gas_line', 'plumb_water_source', 'plumb_sewer_type', 'plumb_pipe_material',
        'plumb_hose_bibs', 'plumb_notes',
        // Electrical
        'elec_service_amps', 'elec_panel_count', 'elec_circuits_count', 'elec_outlets_count',
        'elec_switches_count', 'elec_lighting_fixtures', 'elec_recessed_lights',
        'elec_ceiling_fans', 'elec_240v_circuits', 'elec_gfci_locations', 'elec_smoke_detectors',
        'elec_generator_ready', 'elec_solar_ready', 'elec_ev_charger_ready',
        'elec_low_voltage_runs', 'elec_notes',
        // HVAC
        'hvac_system_type', 'hvac_fuel_type', 'hvac_zones', 'hvac_duct_linear_ft',
        'hvac_return_count', 'hvac_supply_count', 'hvac_thermostat_count',
        'hvac_filter_size', 'hvac_seer_rating', 'hvac_notes',
        // Exterior
        'ext_siding_sqft', 'ext_stucco_sqft', 'ext_brick_sqft', 'ext_stone_sqft',
        'ext_soffit_linear_ft', 'ext_fascia_linear_ft', 'ext_gutter_linear_ft',
        'ext_driveway_sqft', 'ext_driveway_material', 'ext_sidewalk_sqft',
        'ext_patio_sqft', 'ext_deck_sqft', 'ext_fence_linear_ft', 'ext_fence_type',
        'ext_retaining_wall_ft', 'ext_irrigation_zones', 'ext_pool_sqft',
        'ext_pool_equipment', 'ext_notes',
        // Roofing
        'roof_sqft', 'roof_squares', 'roof_material', 'roof_manufacturer',
        'roof_warranty_years', 'roof_underlayment', 'roof_valleys_count',
        'roof_hips_ridges_ft', 'roof_penetrations', 'roof_skylights', 'roof_notes',
        // Insulation
        'insul_wall_type', 'insul_wall_r_value', 'insul_ceiling_type',
        'insul_ceiling_r_value', 'insul_floor_type', 'insul_floor_r_value', 'insul_notes',
        // Appliances
        'appl_range_type', 'appl_oven_type', 'appl_cooktop', 'appl_vent_hood_type',
        'appl_refrigerator_type', 'appl_dishwasher', 'appl_disposal',
        'appl_microwave_type', 'appl_washer_dryer_hookup', 'appl_washer_dryer_gas', 'appl_notes',
        // Code & Permits
        'code_building_code', 'code_energy_code', 'code_occupancy_type',
        'code_construction_type', 'code_fire_sprinklers', 'code_ada_required',
        'setback_front', 'setback_rear', 'setback_left', 'setback_right',
        'lot_coverage_allowed', 'lot_coverage_actual', 'height_limit', 'height_actual',
        // Team
        'team_architect_firm', 'team_architect_phone', 'team_architect_license',
        'team_engineer_firm', 'team_engineer_phone', 'team_engineer_license',
        'team_surveyor', 'team_geotech', 'team_interior_designer',
        // Materials
        'mat_framing_bf', 'mat_drywall_sheets', 'mat_drywall_sqft',
        'mat_paint_sqft', 'mat_trim_linear_ft', 'mat_baseboard_linear_ft', 'mat_crown_linear_ft',
      ];

      for (const field of specFields) {
        if (specs[field] !== job[field]) {
          specsToUpdate[field] = specs[field];
        }
      }

      if (Object.keys(specsToUpdate).length === 0) {
        toast.info('No changes to save');
        return;
      }

      await updateSpecs.mutateAsync({ id: job.id, ...specsToUpdate });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Job Specifications: {job?.name}
          </DialogTitle>
          <DialogDescription>
            Comprehensive building specifications for estimating, scheduling, and historical tracking.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Accordion
            type="multiple"
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="w-full py-4"
          >
            {/* BASIC BUILDING INFO */}
            <AccordionItem value="basic">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Basic Building Information
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Conditioned Sq Ft">
                    <NumberInput
                      value={specs.sqft_conditioned}
                      onChange={(v) => updateField('sqft_conditioned', v)}
                      placeholder="3500"
                    />
                  </FormField>
                  <FormField label="Total Sq Ft">
                    <NumberInput
                      value={specs.sqft_total}
                      onChange={(v) => updateField('sqft_total', v)}
                      placeholder="4500"
                    />
                  </FormField>
                  <FormField label="Garage Sq Ft">
                    <NumberInput
                      value={specs.sqft_garage}
                      onChange={(v) => updateField('sqft_garage', v)}
                      placeholder="600"
                    />
                  </FormField>
                  <FormField label="Covered Sq Ft">
                    <NumberInput
                      value={specs.sqft_covered}
                      onChange={(v) => updateField('sqft_covered', v)}
                      placeholder="400"
                    />
                  </FormField>

                  <FormField label="Lot Size (sq ft)">
                    <NumberInput
                      value={specs.lot_size_sqft}
                      onChange={(v) => updateField('lot_size_sqft', v)}
                      placeholder="10000"
                    />
                  </FormField>
                  <FormField label="Lot Size (acres)">
                    <NumberInput
                      value={specs.lot_size_acres}
                      onChange={(v) => updateField('lot_size_acres', v)}
                      step="0.01"
                      placeholder="0.25"
                    />
                  </FormField>
                  <FormField label="Bedrooms">
                    <NumberInput
                      value={specs.bedrooms}
                      onChange={(v) => updateField('bedrooms', v)}
                      min={0}
                    />
                  </FormField>
                  <FormField label="Full Baths">
                    <NumberInput
                      value={specs.bathrooms}
                      onChange={(v) => updateField('bathrooms', v)}
                      step="0.5"
                    />
                  </FormField>

                  <FormField label="Half Baths">
                    <NumberInput
                      value={specs.half_baths}
                      onChange={(v) => updateField('half_baths', v)}
                      min={0}
                    />
                  </FormField>
                  <FormField label="Stories">
                    <NumberInput
                      value={specs.stories}
                      onChange={(v) => updateField('stories', v)}
                      step="0.5"
                    />
                  </FormField>
                  <FormField label="Garage Spaces">
                    <NumberInput
                      value={specs.garage_spaces}
                      onChange={(v) => updateField('garage_spaces', v)}
                    />
                  </FormField>
                  <FormField label="AC Units">
                    <NumberInput
                      value={specs.ac_units}
                      onChange={(v) => updateField('ac_units', v)}
                    />
                  </FormField>

                  <FormField label="AC Tonnage">
                    <NumberInput
                      value={specs.ac_tonnage}
                      onChange={(v) => updateField('ac_tonnage', v)}
                      step="0.5"
                    />
                  </FormField>
                  <FormField label="Pool Type">
                    <SpecSelect
                      value={specs.pool_type}
                      onChange={(v) => updateField('pool_type', v === '_none_' ? '' : v)}
                      options={poolTypeOptions}
                    />
                  </FormField>
                  <FormField label="Foundation Type">
                    <SpecSelect
                      value={specs.foundation_type}
                      onChange={(v) => updateField('foundation_type', v === '_none_' ? '' : v)}
                      options={foundationTypeOptions}
                    />
                  </FormField>
                  <FormField label="Roof Type">
                    <SpecSelect
                      value={specs.roof_type}
                      onChange={(v) => updateField('roof_type', v === '_none_' ? '' : v)}
                      options={roofTypeOptions}
                    />
                  </FormField>

                  <FormField label="Exterior Finish">
                    <SpecSelect
                      value={specs.exterior_finish}
                      onChange={(v) => updateField('exterior_finish', v === '_none_' ? '' : v)}
                      options={exteriorFinishOptions}
                    />
                  </FormField>
                  <FormField label="Year Built">
                    <NumberInput
                      value={specs.year_built}
                      onChange={(v) => updateField('year_built', v)}
                      placeholder="2024"
                    />
                  </FormField>
                  <FormField label="Zoning">
                    <Input
                      value={specs.zoning || ''}
                      onChange={(e) => updateField('zoning', e.target.value)}
                      placeholder="R-1"
                    />
                  </FormField>
                  <FormField label="Flood Zone">
                    <Input
                      value={specs.flood_zone || ''}
                      onChange={(e) => updateField('flood_zone', e.target.value)}
                      placeholder="X"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField label="Parcel ID">
                    <Input
                      value={specs.parcel_id || ''}
                      onChange={(e) => updateField('parcel_id', e.target.value)}
                      placeholder="123-456-789"
                    />
                  </FormField>
                  <FormField label="Permit Number">
                    <Input
                      value={specs.permit_number || ''}
                      onChange={(e) => updateField('permit_number', e.target.value)}
                      placeholder="BLD-2024-1234"
                    />
                  </FormField>
                </div>

                <FormField label="Legal Description" className="mt-4">
                  <Textarea
                    value={specs.legal_description || ''}
                    onChange={(e) => updateField('legal_description', e.target.value)}
                    placeholder="Lot 5, Block 3, Subdivision Name..."
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* STRUCTURAL */}
            <AccordionItem value="structural">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4" />
                  Structural
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Foundation Depth (in)">
                    <NumberInput
                      value={specs.struct_foundation_depth}
                      onChange={(v) => updateField('struct_foundation_depth', v)}
                    />
                  </FormField>
                  <FormField label="Foundation Width (in)">
                    <NumberInput
                      value={specs.struct_foundation_width}
                      onChange={(v) => updateField('struct_foundation_width', v)}
                    />
                  </FormField>
                  <FormField label="Pier Count">
                    <NumberInput
                      value={specs.struct_pier_count}
                      onChange={(v) => updateField('struct_pier_count', v)}
                    />
                  </FormField>
                  <FormField label="Pier Depth (ft)">
                    <NumberInput
                      value={specs.struct_pier_depth}
                      onChange={(v) => updateField('struct_pier_depth', v)}
                    />
                  </FormField>

                  <FormField label="Concrete PSI">
                    <NumberInput
                      value={specs.struct_concrete_psi}
                      onChange={(v) => updateField('struct_concrete_psi', v)}
                      placeholder="3000"
                    />
                  </FormField>
                  <FormField label="Concrete Yards">
                    <NumberInput
                      value={specs.struct_concrete_yards}
                      onChange={(v) => updateField('struct_concrete_yards', v)}
                      step="0.1"
                    />
                  </FormField>
                  <FormField label="Rebar Tons">
                    <NumberInput
                      value={specs.struct_rebar_tons}
                      onChange={(v) => updateField('struct_rebar_tons', v)}
                      step="0.01"
                    />
                  </FormField>
                  <FormField label="Steel Beams">
                    <NumberInput
                      value={specs.struct_steel_beams}
                      onChange={(v) => updateField('struct_steel_beams', v)}
                    />
                  </FormField>

                  <FormField label="Steel Columns">
                    <NumberInput
                      value={specs.struct_steel_columns}
                      onChange={(v) => updateField('struct_steel_columns', v)}
                    />
                  </FormField>
                  <FormField label="Steel Tonnage">
                    <NumberInput
                      value={specs.struct_steel_tonnage}
                      onChange={(v) => updateField('struct_steel_tonnage', v)}
                      step="0.01"
                    />
                  </FormField>
                  <FormField label="Wood Beams">
                    <NumberInput
                      value={specs.struct_wood_beam_count}
                      onChange={(v) => updateField('struct_wood_beam_count', v)}
                    />
                  </FormField>
                  <FormField label="LVL Beams">
                    <NumberInput
                      value={specs.struct_lvl_beam_count}
                      onChange={(v) => updateField('struct_lvl_beam_count', v)}
                    />
                  </FormField>

                  <FormField label="Truss Count">
                    <NumberInput
                      value={specs.struct_truss_count}
                      onChange={(v) => updateField('struct_truss_count', v)}
                    />
                  </FormField>
                  <FormField label="Max Truss Span (ft)">
                    <NumberInput
                      value={specs.struct_truss_span_max}
                      onChange={(v) => updateField('struct_truss_span_max', v)}
                    />
                  </FormField>
                  <FormField label="Roof Pitch">
                    <Input
                      value={specs.struct_roof_pitch || ''}
                      onChange={(e) => updateField('struct_roof_pitch', e.target.value)}
                      placeholder="4:12"
                    />
                  </FormField>
                  <FormField label="Wall Framing">
                    <Input
                      value={specs.struct_wall_framing || ''}
                      onChange={(e) => updateField('struct_wall_framing', e.target.value)}
                      placeholder="2x6"
                    />
                  </FormField>

                  <FormField label="Design Wind Speed (mph)">
                    <NumberInput
                      value={specs.struct_wind_speed}
                      onChange={(v) => updateField('struct_wind_speed', v)}
                      placeholder="150"
                    />
                  </FormField>
                  <FormField label="Exposure Category">
                    <Input
                      value={specs.struct_exposure_category || ''}
                      onChange={(e) => updateField('struct_exposure_category', e.target.value)}
                      placeholder="C"
                    />
                  </FormField>
                  <FormField label="Floor Live Load (PSF)">
                    <NumberInput
                      value={specs.struct_live_load_floor}
                      onChange={(v) => updateField('struct_live_load_floor', v)}
                      placeholder="40"
                    />
                  </FormField>
                  <FormField label="Roof Live Load (PSF)">
                    <NumberInput
                      value={specs.struct_live_load_roof}
                      onChange={(v) => updateField('struct_live_load_roof', v)}
                      placeholder="20"
                    />
                  </FormField>
                </div>

                <FormField label="Structural Notes" className="mt-4">
                  <Textarea
                    value={specs.struct_notes || ''}
                    onChange={(e) => updateField('struct_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* WINDOWS & DOORS */}
            <AccordionItem value="windows-doors">
              <AccordionTrigger className="text-base font-semibold">
                Windows & Doors
              </AccordionTrigger>
              <AccordionContent>
                <h4 className="font-medium mb-3">Windows</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Total Windows">
                    <NumberInput
                      value={specs.windows_total_count}
                      onChange={(v) => updateField('windows_total_count', v)}
                    />
                  </FormField>
                  <FormField label="Total Window Sq Ft">
                    <NumberInput
                      value={specs.windows_total_sqft}
                      onChange={(v) => updateField('windows_total_sqft', v)}
                      step="0.01"
                    />
                  </FormField>
                  <FormField label="Frame Material">
                    <SpecSelect
                      value={specs.windows_frame_material}
                      onChange={(v) => updateField('windows_frame_material', v === '_none_' ? '' : v)}
                      options={windowFrameOptions}
                    />
                  </FormField>
                  <FormField label="Glass Type">
                    <SpecSelect
                      value={specs.windows_glass_type}
                      onChange={(v) => updateField('windows_glass_type', v === '_none_' ? '' : v)}
                      options={windowGlassOptions}
                    />
                  </FormField>

                  <FormField label="Manufacturer">
                    <Input
                      value={specs.windows_manufacturer || ''}
                      onChange={(e) => updateField('windows_manufacturer', e.target.value)}
                      placeholder="PGT, Andersen..."
                    />
                  </FormField>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="windows_impact"
                      checked={specs.windows_impact_rated || false}
                      onCheckedChange={(v) => updateField('windows_impact_rated', v)}
                    />
                    <Label htmlFor="windows_impact">Impact Rated</Label>
                  </div>
                </div>

                <h4 className="font-medium mb-3 mt-6">Doors</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Exterior Doors">
                    <NumberInput
                      value={specs.doors_exterior_count}
                      onChange={(v) => updateField('doors_exterior_count', v)}
                    />
                  </FormField>
                  <FormField label="Interior Doors">
                    <NumberInput
                      value={specs.doors_interior_count}
                      onChange={(v) => updateField('doors_interior_count', v)}
                    />
                  </FormField>
                  <FormField label="Garage Doors">
                    <NumberInput
                      value={specs.doors_garage_count}
                      onChange={(v) => updateField('doors_garage_count', v)}
                    />
                  </FormField>
                  <FormField label="Garage Width (ft)">
                    <NumberInput
                      value={specs.doors_garage_width}
                      onChange={(v) => updateField('doors_garage_width', v)}
                    />
                  </FormField>

                  <FormField label="Door Manufacturer">
                    <Input
                      value={specs.doors_manufacturer || ''}
                      onChange={(e) => updateField('doors_manufacturer', e.target.value)}
                    />
                  </FormField>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="doors_impact"
                      checked={specs.doors_impact_rated || false}
                      onCheckedChange={(v) => updateField('doors_impact_rated', v)}
                    />
                    <Label htmlFor="doors_impact">Impact Rated</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PLUMBING */}
            <AccordionItem value="plumbing">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Plumbing
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Total Fixtures">
                    <NumberInput
                      value={specs.plumb_fixtures_total}
                      onChange={(v) => updateField('plumb_fixtures_total', v)}
                    />
                  </FormField>
                  <FormField label="Toilets">
                    <NumberInput
                      value={specs.plumb_toilets}
                      onChange={(v) => updateField('plumb_toilets', v)}
                    />
                  </FormField>
                  <FormField label="Sinks">
                    <NumberInput
                      value={specs.plumb_sinks}
                      onChange={(v) => updateField('plumb_sinks', v)}
                    />
                  </FormField>
                  <FormField label="Showers">
                    <NumberInput
                      value={specs.plumb_showers}
                      onChange={(v) => updateField('plumb_showers', v)}
                    />
                  </FormField>

                  <FormField label="Tubs">
                    <NumberInput
                      value={specs.plumb_tubs}
                      onChange={(v) => updateField('plumb_tubs', v)}
                    />
                  </FormField>
                  <FormField label="Hose Bibs">
                    <NumberInput
                      value={specs.plumb_hose_bibs}
                      onChange={(v) => updateField('plumb_hose_bibs', v)}
                    />
                  </FormField>
                  <FormField label="Water Heater Type">
                    <SpecSelect
                      value={specs.plumb_water_heater_type}
                      onChange={(v) => updateField('plumb_water_heater_type', v === '_none_' ? '' : v)}
                      options={waterHeaterOptions}
                    />
                  </FormField>
                  <FormField label="WH Gallons">
                    <NumberInput
                      value={specs.plumb_water_heater_gallons}
                      onChange={(v) => updateField('plumb_water_heater_gallons', v)}
                      placeholder="50"
                    />
                  </FormField>

                  <FormField label="Water Heater Count">
                    <NumberInput
                      value={specs.plumb_water_heater_count}
                      onChange={(v) => updateField('plumb_water_heater_count', v)}
                    />
                  </FormField>
                  <FormField label="Pipe Material">
                    <SpecSelect
                      value={specs.plumb_pipe_material}
                      onChange={(v) => updateField('plumb_pipe_material', v === '_none_' ? '' : v)}
                      options={pipeMaterialOptions}
                    />
                  </FormField>
                  <FormField label="Water Source">
                    <Input
                      value={specs.plumb_water_source || ''}
                      onChange={(e) => updateField('plumb_water_source', e.target.value)}
                      placeholder="City, Well"
                    />
                  </FormField>
                  <FormField label="Sewer Type">
                    <Input
                      value={specs.plumb_sewer_type || ''}
                      onChange={(e) => updateField('plumb_sewer_type', e.target.value)}
                      placeholder="City, Septic"
                    />
                  </FormField>
                </div>

                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="gas_line"
                    checked={specs.plumb_gas_line || false}
                    onCheckedChange={(v) => updateField('plumb_gas_line', v)}
                  />
                  <Label htmlFor="gas_line">Gas Line to House</Label>
                </div>

                <FormField label="Plumbing Notes" className="mt-4">
                  <Textarea
                    value={specs.plumb_notes || ''}
                    onChange={(e) => updateField('plumb_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* ELECTRICAL */}
            <AccordionItem value="electrical">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Electrical
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Service Amps">
                    <NumberInput
                      value={specs.elec_service_amps}
                      onChange={(v) => updateField('elec_service_amps', v)}
                      placeholder="200"
                    />
                  </FormField>
                  <FormField label="Panel Count">
                    <NumberInput
                      value={specs.elec_panel_count}
                      onChange={(v) => updateField('elec_panel_count', v)}
                    />
                  </FormField>
                  <FormField label="Total Circuits">
                    <NumberInput
                      value={specs.elec_circuits_count}
                      onChange={(v) => updateField('elec_circuits_count', v)}
                    />
                  </FormField>
                  <FormField label="240V Circuits">
                    <NumberInput
                      value={specs.elec_240v_circuits}
                      onChange={(v) => updateField('elec_240v_circuits', v)}
                    />
                  </FormField>

                  <FormField label="Outlets">
                    <NumberInput
                      value={specs.elec_outlets_count}
                      onChange={(v) => updateField('elec_outlets_count', v)}
                    />
                  </FormField>
                  <FormField label="Switches">
                    <NumberInput
                      value={specs.elec_switches_count}
                      onChange={(v) => updateField('elec_switches_count', v)}
                    />
                  </FormField>
                  <FormField label="Light Fixtures">
                    <NumberInput
                      value={specs.elec_lighting_fixtures}
                      onChange={(v) => updateField('elec_lighting_fixtures', v)}
                    />
                  </FormField>
                  <FormField label="Recessed Lights">
                    <NumberInput
                      value={specs.elec_recessed_lights}
                      onChange={(v) => updateField('elec_recessed_lights', v)}
                    />
                  </FormField>

                  <FormField label="Ceiling Fans">
                    <NumberInput
                      value={specs.elec_ceiling_fans}
                      onChange={(v) => updateField('elec_ceiling_fans', v)}
                    />
                  </FormField>
                  <FormField label="GFCI Locations">
                    <NumberInput
                      value={specs.elec_gfci_locations}
                      onChange={(v) => updateField('elec_gfci_locations', v)}
                    />
                  </FormField>
                  <FormField label="Smoke Detectors">
                    <NumberInput
                      value={specs.elec_smoke_detectors}
                      onChange={(v) => updateField('elec_smoke_detectors', v)}
                    />
                  </FormField>
                  <FormField label="Low Voltage Runs">
                    <NumberInput
                      value={specs.elec_low_voltage_runs}
                      onChange={(v) => updateField('elec_low_voltage_runs', v)}
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap gap-6 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gen_ready"
                      checked={specs.elec_generator_ready || false}
                      onCheckedChange={(v) => updateField('elec_generator_ready', v)}
                    />
                    <Label htmlFor="gen_ready">Generator Ready</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="solar_ready"
                      checked={specs.elec_solar_ready || false}
                      onCheckedChange={(v) => updateField('elec_solar_ready', v)}
                    />
                    <Label htmlFor="solar_ready">Solar Ready</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ev_ready"
                      checked={specs.elec_ev_charger_ready || false}
                      onCheckedChange={(v) => updateField('elec_ev_charger_ready', v)}
                    />
                    <Label htmlFor="ev_ready">EV Charger Ready</Label>
                  </div>
                </div>

                <FormField label="Electrical Notes" className="mt-4">
                  <Textarea
                    value={specs.elec_notes || ''}
                    onChange={(e) => updateField('elec_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* HVAC */}
            <AccordionItem value="hvac">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4" />
                  HVAC
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="System Type">
                    <SpecSelect
                      value={specs.hvac_system_type}
                      onChange={(v) => updateField('hvac_system_type', v === '_none_' ? '' : v)}
                      options={hvacSystemOptions}
                    />
                  </FormField>
                  <FormField label="Fuel Type">
                    <SpecSelect
                      value={specs.hvac_fuel_type}
                      onChange={(v) => updateField('hvac_fuel_type', v === '_none_' ? '' : v)}
                      options={hvacFuelOptions}
                    />
                  </FormField>
                  <FormField label="Zones">
                    <NumberInput
                      value={specs.hvac_zones}
                      onChange={(v) => updateField('hvac_zones', v)}
                    />
                  </FormField>
                  <FormField label="SEER Rating">
                    <NumberInput
                      value={specs.hvac_seer_rating}
                      onChange={(v) => updateField('hvac_seer_rating', v)}
                      step="0.1"
                      placeholder="16"
                    />
                  </FormField>

                  <FormField label="Duct Linear Ft">
                    <NumberInput
                      value={specs.hvac_duct_linear_ft}
                      onChange={(v) => updateField('hvac_duct_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Supply Count">
                    <NumberInput
                      value={specs.hvac_supply_count}
                      onChange={(v) => updateField('hvac_supply_count', v)}
                    />
                  </FormField>
                  <FormField label="Return Count">
                    <NumberInput
                      value={specs.hvac_return_count}
                      onChange={(v) => updateField('hvac_return_count', v)}
                    />
                  </FormField>
                  <FormField label="Thermostats">
                    <NumberInput
                      value={specs.hvac_thermostat_count}
                      onChange={(v) => updateField('hvac_thermostat_count', v)}
                    />
                  </FormField>

                  <FormField label="Filter Size">
                    <Input
                      value={specs.hvac_filter_size || ''}
                      onChange={(e) => updateField('hvac_filter_size', e.target.value)}
                      placeholder="20x25x1"
                    />
                  </FormField>
                </div>

                <FormField label="HVAC Notes" className="mt-4">
                  <Textarea
                    value={specs.hvac_notes || ''}
                    onChange={(e) => updateField('hvac_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* INTERIOR FINISHES */}
            <AccordionItem value="interior">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <PaintBucket className="h-4 w-4" />
                  Interior Finishes
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Main Ceiling Height (ft)">
                    <NumberInput
                      value={specs.ceiling_height_main}
                      onChange={(v) => updateField('ceiling_height_main', v)}
                      step="0.5"
                      placeholder="10"
                    />
                  </FormField>
                  <FormField label="Max Ceiling Height (ft)">
                    <NumberInput
                      value={specs.ceiling_height_max}
                      onChange={(v) => updateField('ceiling_height_max', v)}
                      step="0.5"
                      placeholder="20"
                    />
                  </FormField>
                  <FormField label="Fireplace Count">
                    <NumberInput
                      value={specs.fireplace_count}
                      onChange={(v) => updateField('fireplace_count', v)}
                    />
                  </FormField>
                  <FormField label="Fireplace Type">
                    <Input
                      value={specs.fireplace_type || ''}
                      onChange={(e) => updateField('fireplace_type', e.target.value)}
                      placeholder="Gas, Wood, Electric"
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Flooring</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Tile (sq ft)">
                    <NumberInput
                      value={specs.flooring_tile_sqft}
                      onChange={(v) => updateField('flooring_tile_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Wood (sq ft)">
                    <NumberInput
                      value={specs.flooring_wood_sqft}
                      onChange={(v) => updateField('flooring_wood_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Carpet (sq ft)">
                    <NumberInput
                      value={specs.flooring_carpet_sqft}
                      onChange={(v) => updateField('flooring_carpet_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Other (sq ft)">
                    <NumberInput
                      value={specs.flooring_other_sqft}
                      onChange={(v) => updateField('flooring_other_sqft', v)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Cabinets & Counters</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Countertop Material">
                    <SpecSelect
                      value={specs.countertop_material}
                      onChange={(v) => updateField('countertop_material', v === '_none_' ? '' : v)}
                      options={countertopOptions}
                    />
                  </FormField>
                  <FormField label="Countertop Linear Ft">
                    <NumberInput
                      value={specs.countertop_linear_ft}
                      onChange={(v) => updateField('countertop_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Cabinet Linear Ft">
                    <NumberInput
                      value={specs.cabinet_linear_ft}
                      onChange={(v) => updateField('cabinet_linear_ft', v)}
                    />
                  </FormField>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* EXTERIOR & SITE */}
            <AccordionItem value="exterior">
              <AccordionTrigger className="text-base font-semibold">
                Exterior & Site Work
              </AccordionTrigger>
              <AccordionContent>
                <h4 className="font-medium mb-3">Exterior Cladding</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Siding (sq ft)">
                    <NumberInput
                      value={specs.ext_siding_sqft}
                      onChange={(v) => updateField('ext_siding_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Stucco (sq ft)">
                    <NumberInput
                      value={specs.ext_stucco_sqft}
                      onChange={(v) => updateField('ext_stucco_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Brick (sq ft)">
                    <NumberInput
                      value={specs.ext_brick_sqft}
                      onChange={(v) => updateField('ext_brick_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Stone (sq ft)">
                    <NumberInput
                      value={specs.ext_stone_sqft}
                      onChange={(v) => updateField('ext_stone_sqft', v)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Trim & Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Soffit (linear ft)">
                    <NumberInput
                      value={specs.ext_soffit_linear_ft}
                      onChange={(v) => updateField('ext_soffit_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Fascia (linear ft)">
                    <NumberInput
                      value={specs.ext_fascia_linear_ft}
                      onChange={(v) => updateField('ext_fascia_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Gutter (linear ft)">
                    <NumberInput
                      value={specs.ext_gutter_linear_ft}
                      onChange={(v) => updateField('ext_gutter_linear_ft', v)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Hardscape</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Driveway (sq ft)">
                    <NumberInput
                      value={specs.ext_driveway_sqft}
                      onChange={(v) => updateField('ext_driveway_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Driveway Material">
                    <Input
                      value={specs.ext_driveway_material || ''}
                      onChange={(e) => updateField('ext_driveway_material', e.target.value)}
                      placeholder="Concrete, Pavers"
                    />
                  </FormField>
                  <FormField label="Sidewalk (sq ft)">
                    <NumberInput
                      value={specs.ext_sidewalk_sqft}
                      onChange={(v) => updateField('ext_sidewalk_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Patio (sq ft)">
                    <NumberInput
                      value={specs.ext_patio_sqft}
                      onChange={(v) => updateField('ext_patio_sqft', v)}
                    />
                  </FormField>

                  <FormField label="Deck (sq ft)">
                    <NumberInput
                      value={specs.ext_deck_sqft}
                      onChange={(v) => updateField('ext_deck_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Fence (linear ft)">
                    <NumberInput
                      value={specs.ext_fence_linear_ft}
                      onChange={(v) => updateField('ext_fence_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Fence Type">
                    <Input
                      value={specs.ext_fence_type || ''}
                      onChange={(e) => updateField('ext_fence_type', e.target.value)}
                      placeholder="Wood, Aluminum, PVC"
                    />
                  </FormField>
                  <FormField label="Retaining Wall (ft)">
                    <NumberInput
                      value={specs.ext_retaining_wall_ft}
                      onChange={(v) => updateField('ext_retaining_wall_ft', v)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Pool & Landscape</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Pool (sq ft)">
                    <NumberInput
                      value={specs.ext_pool_sqft}
                      onChange={(v) => updateField('ext_pool_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Pool Equipment">
                    <Input
                      value={specs.ext_pool_equipment || ''}
                      onChange={(e) => updateField('ext_pool_equipment', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Irrigation Zones">
                    <NumberInput
                      value={specs.ext_irrigation_zones}
                      onChange={(v) => updateField('ext_irrigation_zones', v)}
                    />
                  </FormField>
                </div>

                <FormField label="Exterior Notes" className="mt-4">
                  <Textarea
                    value={specs.ext_notes || ''}
                    onChange={(e) => updateField('ext_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* ROOFING */}
            <AccordionItem value="roofing">
              <AccordionTrigger className="text-base font-semibold">
                Roofing
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Roof Area (sq ft)">
                    <NumberInput
                      value={specs.roof_sqft}
                      onChange={(v) => updateField('roof_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Roof Squares">
                    <NumberInput
                      value={specs.roof_squares}
                      onChange={(v) => updateField('roof_squares', v)}
                      step="0.1"
                    />
                  </FormField>
                  <FormField label="Material">
                    <Input
                      value={specs.roof_material || ''}
                      onChange={(e) => updateField('roof_material', e.target.value)}
                      placeholder="Architectural Shingle"
                    />
                  </FormField>
                  <FormField label="Manufacturer">
                    <Input
                      value={specs.roof_manufacturer || ''}
                      onChange={(e) => updateField('roof_manufacturer', e.target.value)}
                    />
                  </FormField>

                  <FormField label="Warranty (years)">
                    <NumberInput
                      value={specs.roof_warranty_years}
                      onChange={(v) => updateField('roof_warranty_years', v)}
                    />
                  </FormField>
                  <FormField label="Underlayment">
                    <Input
                      value={specs.roof_underlayment || ''}
                      onChange={(e) => updateField('roof_underlayment', e.target.value)}
                      placeholder="Synthetic"
                    />
                  </FormField>
                  <FormField label="Valleys">
                    <NumberInput
                      value={specs.roof_valleys_count}
                      onChange={(v) => updateField('roof_valleys_count', v)}
                    />
                  </FormField>
                  <FormField label="Hips/Ridges (ft)">
                    <NumberInput
                      value={specs.roof_hips_ridges_ft}
                      onChange={(v) => updateField('roof_hips_ridges_ft', v)}
                    />
                  </FormField>

                  <FormField label="Penetrations">
                    <NumberInput
                      value={specs.roof_penetrations}
                      onChange={(v) => updateField('roof_penetrations', v)}
                    />
                  </FormField>
                  <FormField label="Skylights">
                    <NumberInput
                      value={specs.roof_skylights}
                      onChange={(v) => updateField('roof_skylights', v)}
                    />
                  </FormField>
                </div>

                <FormField label="Roofing Notes" className="mt-4">
                  <Textarea
                    value={specs.roof_notes || ''}
                    onChange={(e) => updateField('roof_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* INSULATION */}
            <AccordionItem value="insulation">
              <AccordionTrigger className="text-base font-semibold">
                Insulation
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <FormField label="Wall Type">
                    <SpecSelect
                      value={specs.insul_wall_type}
                      onChange={(v) => updateField('insul_wall_type', v === '_none_' ? '' : v)}
                      options={insulationTypeOptions}
                    />
                  </FormField>
                  <FormField label="Wall R-Value">
                    <NumberInput
                      value={specs.insul_wall_r_value}
                      onChange={(v) => updateField('insul_wall_r_value', v)}
                      step="0.1"
                    />
                  </FormField>
                  <FormField label="Ceiling Type">
                    <SpecSelect
                      value={specs.insul_ceiling_type}
                      onChange={(v) => updateField('insul_ceiling_type', v === '_none_' ? '' : v)}
                      options={insulationTypeOptions}
                    />
                  </FormField>

                  <FormField label="Ceiling R-Value">
                    <NumberInput
                      value={specs.insul_ceiling_r_value}
                      onChange={(v) => updateField('insul_ceiling_r_value', v)}
                      step="0.1"
                    />
                  </FormField>
                  <FormField label="Floor Type">
                    <SpecSelect
                      value={specs.insul_floor_type}
                      onChange={(v) => updateField('insul_floor_type', v === '_none_' ? '' : v)}
                      options={insulationTypeOptions}
                    />
                  </FormField>
                  <FormField label="Floor R-Value">
                    <NumberInput
                      value={specs.insul_floor_r_value}
                      onChange={(v) => updateField('insul_floor_r_value', v)}
                      step="0.1"
                    />
                  </FormField>
                </div>

                <FormField label="Insulation Notes" className="mt-4">
                  <Textarea
                    value={specs.insul_notes || ''}
                    onChange={(e) => updateField('insul_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* APPLIANCES */}
            <AccordionItem value="appliances">
              <AccordionTrigger className="text-base font-semibold">
                Appliances
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <FormField label="Range Type">
                    <Input
                      value={specs.appl_range_type || ''}
                      onChange={(e) => updateField('appl_range_type', e.target.value)}
                      placeholder="Gas, Electric, Induction"
                    />
                  </FormField>
                  <FormField label="Oven Type">
                    <Input
                      value={specs.appl_oven_type || ''}
                      onChange={(e) => updateField('appl_oven_type', e.target.value)}
                      placeholder="Single, Double, Wall"
                    />
                  </FormField>
                  <FormField label="Vent Hood Type">
                    <Input
                      value={specs.appl_vent_hood_type || ''}
                      onChange={(e) => updateField('appl_vent_hood_type', e.target.value)}
                    />
                  </FormField>

                  <FormField label="Refrigerator Type">
                    <Input
                      value={specs.appl_refrigerator_type || ''}
                      onChange={(e) => updateField('appl_refrigerator_type', e.target.value)}
                      placeholder="French Door, Side-by-Side"
                    />
                  </FormField>
                  <FormField label="Microwave Type">
                    <Input
                      value={specs.appl_microwave_type || ''}
                      onChange={(e) => updateField('appl_microwave_type', e.target.value)}
                      placeholder="Built-in, OTR"
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap gap-6 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cooktop"
                      checked={specs.appl_cooktop || false}
                      onCheckedChange={(v) => updateField('appl_cooktop', v)}
                    />
                    <Label htmlFor="cooktop">Separate Cooktop</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dishwasher"
                      checked={specs.appl_dishwasher || false}
                      onCheckedChange={(v) => updateField('appl_dishwasher', v)}
                    />
                    <Label htmlFor="dishwasher">Dishwasher</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="disposal"
                      checked={specs.appl_disposal || false}
                      onCheckedChange={(v) => updateField('appl_disposal', v)}
                    />
                    <Label htmlFor="disposal">Garbage Disposal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="washer_hookup"
                      checked={specs.appl_washer_dryer_hookup || false}
                      onCheckedChange={(v) => updateField('appl_washer_dryer_hookup', v)}
                    />
                    <Label htmlFor="washer_hookup">Washer/Dryer Hookup</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="washer_gas"
                      checked={specs.appl_washer_dryer_gas || false}
                      onCheckedChange={(v) => updateField('appl_washer_dryer_gas', v)}
                    />
                    <Label htmlFor="washer_gas">Gas Dryer Hookup</Label>
                  </div>
                </div>

                <FormField label="Appliance Notes" className="mt-4">
                  <Textarea
                    value={specs.appl_notes || ''}
                    onChange={(e) => updateField('appl_notes', e.target.value)}
                    rows={2}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>

            {/* CODE & PERMITS */}
            <AccordionItem value="code">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Code & Permits
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <FormField label="Building Code">
                    <Input
                      value={specs.code_building_code || ''}
                      onChange={(e) => updateField('code_building_code', e.target.value)}
                      placeholder="FBC 7th Edition"
                    />
                  </FormField>
                  <FormField label="Energy Code">
                    <Input
                      value={specs.code_energy_code || ''}
                      onChange={(e) => updateField('code_energy_code', e.target.value)}
                      placeholder="IECC 2021"
                    />
                  </FormField>
                  <FormField label="Occupancy Type">
                    <Input
                      value={specs.code_occupancy_type || ''}
                      onChange={(e) => updateField('code_occupancy_type', e.target.value)}
                      placeholder="R-3"
                    />
                  </FormField>

                  <FormField label="Construction Type">
                    <Input
                      value={specs.code_construction_type || ''}
                      onChange={(e) => updateField('code_construction_type', e.target.value)}
                      placeholder="Type V-B"
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap gap-6 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sprinklers"
                      checked={specs.code_fire_sprinklers || false}
                      onCheckedChange={(v) => updateField('code_fire_sprinklers', v)}
                    />
                    <Label htmlFor="sprinklers">Fire Sprinklers Required</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ada"
                      checked={specs.code_ada_required || false}
                      onCheckedChange={(v) => updateField('code_ada_required', v)}
                    />
                    <Label htmlFor="ada">ADA Required</Label>
                  </div>
                </div>

                <h4 className="font-medium mt-4 mb-3">Setbacks (ft)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Front">
                    <NumberInput
                      value={specs.setback_front}
                      onChange={(v) => updateField('setback_front', v)}
                    />
                  </FormField>
                  <FormField label="Rear">
                    <NumberInput
                      value={specs.setback_rear}
                      onChange={(v) => updateField('setback_rear', v)}
                    />
                  </FormField>
                  <FormField label="Left Side">
                    <NumberInput
                      value={specs.setback_left}
                      onChange={(v) => updateField('setback_left', v)}
                    />
                  </FormField>
                  <FormField label="Right Side">
                    <NumberInput
                      value={specs.setback_right}
                      onChange={(v) => updateField('setback_right', v)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Lot Coverage & Height</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Allowed Coverage (%)">
                    <NumberInput
                      value={specs.lot_coverage_allowed}
                      onChange={(v) => updateField('lot_coverage_allowed', v)}
                      step="0.01"
                    />
                  </FormField>
                  <FormField label="Actual Coverage (%)">
                    <NumberInput
                      value={specs.lot_coverage_actual}
                      onChange={(v) => updateField('lot_coverage_actual', v)}
                      step="0.01"
                    />
                  </FormField>
                  <FormField label="Height Limit (ft)">
                    <NumberInput
                      value={specs.height_limit}
                      onChange={(v) => updateField('height_limit', v)}
                    />
                  </FormField>
                  <FormField label="Actual Height (ft)">
                    <NumberInput
                      value={specs.height_actual}
                      onChange={(v) => updateField('height_actual', v)}
                    />
                  </FormField>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PROJECT TEAM */}
            <AccordionItem value="team">
              <AccordionTrigger className="text-base font-semibold">
                Project Team
              </AccordionTrigger>
              <AccordionContent>
                <h4 className="font-medium mb-3">Architect</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Firm">
                    <Input
                      value={specs.team_architect_firm || ''}
                      onChange={(e) => updateField('team_architect_firm', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Phone">
                    <Input
                      value={specs.team_architect_phone || ''}
                      onChange={(e) => updateField('team_architect_phone', e.target.value)}
                    />
                  </FormField>
                  <FormField label="License #">
                    <Input
                      value={specs.team_architect_license || ''}
                      onChange={(e) => updateField('team_architect_license', e.target.value)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Engineer</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Firm">
                    <Input
                      value={specs.team_engineer_firm || ''}
                      onChange={(e) => updateField('team_engineer_firm', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Phone">
                    <Input
                      value={specs.team_engineer_phone || ''}
                      onChange={(e) => updateField('team_engineer_phone', e.target.value)}
                    />
                  </FormField>
                  <FormField label="License #">
                    <Input
                      value={specs.team_engineer_license || ''}
                      onChange={(e) => updateField('team_engineer_license', e.target.value)}
                    />
                  </FormField>
                </div>

                <h4 className="font-medium mt-4 mb-3">Other Consultants</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Surveyor">
                    <Input
                      value={specs.team_surveyor || ''}
                      onChange={(e) => updateField('team_surveyor', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Geotech">
                    <Input
                      value={specs.team_geotech || ''}
                      onChange={(e) => updateField('team_geotech', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Interior Designer">
                    <Input
                      value={specs.team_interior_designer || ''}
                      onChange={(e) => updateField('team_interior_designer', e.target.value)}
                    />
                  </FormField>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* MATERIAL QUANTITIES */}
            <AccordionItem value="materials">
              <AccordionTrigger className="text-base font-semibold">
                Material Quantities
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <FormField label="Framing (board ft)">
                    <NumberInput
                      value={specs.mat_framing_bf}
                      onChange={(v) => updateField('mat_framing_bf', v)}
                    />
                  </FormField>
                  <FormField label="Drywall Sheets">
                    <NumberInput
                      value={specs.mat_drywall_sheets}
                      onChange={(v) => updateField('mat_drywall_sheets', v)}
                    />
                  </FormField>
                  <FormField label="Drywall (sq ft)">
                    <NumberInput
                      value={specs.mat_drywall_sqft}
                      onChange={(v) => updateField('mat_drywall_sqft', v)}
                    />
                  </FormField>
                  <FormField label="Paint (sq ft)">
                    <NumberInput
                      value={specs.mat_paint_sqft}
                      onChange={(v) => updateField('mat_paint_sqft', v)}
                    />
                  </FormField>

                  <FormField label="Trim (linear ft)">
                    <NumberInput
                      value={specs.mat_trim_linear_ft}
                      onChange={(v) => updateField('mat_trim_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Baseboard (linear ft)">
                    <NumberInput
                      value={specs.mat_baseboard_linear_ft}
                      onChange={(v) => updateField('mat_baseboard_linear_ft', v)}
                    />
                  </FormField>
                  <FormField label="Crown (linear ft)">
                    <NumberInput
                      value={specs.mat_crown_linear_ft}
                      onChange={(v) => updateField('mat_crown_linear_ft', v)}
                    />
                  </FormField>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* GENERAL NOTES */}
            <AccordionItem value="notes">
              <AccordionTrigger className="text-base font-semibold">
                General Specs Notes
              </AccordionTrigger>
              <AccordionContent>
                <FormField label="Notes" className="pt-2">
                  <Textarea
                    value={specs.specs_notes || ''}
                    onChange={(e) => updateField('specs_notes', e.target.value)}
                    rows={4}
                    placeholder="General notes about building specifications..."
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateSpecs.isPending}>
            {updateSpecs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Specifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
