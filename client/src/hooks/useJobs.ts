import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Job type based on backend API response
export interface Job {
  id: string;
  name: string;
  address?: string;
  client_name?: string;
  client?: string;
  client_email?: string;
  client_phone?: string;
  client_cell?: string;
  contract_amount?: number;
  budget_amount?: number;
  status: string;
  percent_complete?: number;
  start_date?: string;
  end_date?: string;
  actual_end_date?: string;
  target_margin?: number;
  retainage_percent?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Property Details
  square_footage?: number;
  stories?: number;
  bedrooms?: number;
  bathrooms?: number;
  half_baths?: number;
  garage_spaces?: number;
  lot_size?: number;
  // Structure Details
  architectural_style?: string;
  foundation_type?: string;
  roof_type?: string;
  exterior_finish?: string;
  // Systems
  hvac_system?: string;
  electrical_service?: string;
  plumbing_type?: string;
  // Features
  premium_features?: string[];
  // Team
  project_manager?: string;
  site_supervisor?: string;
  architect?: string;
  engineer?: string;
  // Additional Info
  permit_number?: string;
  parcel_id?: string;
  flood_zone?: string;
  year_built?: number;
  construction_type?: string;
  monthly_supervision_rate?: number;
}

export type JobInsert = Partial<Job>;
export type JobUpdate = Partial<Job>;

interface JobsPaginationParams {
  page?: number;
  limit?: number;
}

interface PaginatedJobsResponse {
  data: Job[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function useJobs(pagination?: JobsPaginationParams) {
  return useQuery({
    queryKey: ['jobs', pagination?.page, pagination?.limit],
    queryFn: async (): Promise<Job[] | PaginatedJobsResponse> => {
      const params = new URLSearchParams();
      if (pagination?.page) params.append('page', String(pagination.page));
      if (pagination?.limit) params.append('limit', String(pagination.limit));

      const url = `/api/jobs${params.size > 0 ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async (): Promise<Job | null> => {
      if (!id) return null;
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: Partial<JobInsert>) => {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!response.ok) throw new Error('Failed to create job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: JobUpdate & { id: string }) => {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update job');
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      toast.success('Job updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update job:', error);
      toast.error('Failed to update job');
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete job');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    },
  });
}

export const statusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export const constructionTypeOptions = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'addition', label: 'Addition' },
  { value: 'renovation', label: 'Renovation' },
];

export const architecturalStyleOptions = [
  { value: 'modern', label: 'Modern' },
  { value: 'contemporary', label: 'Contemporary' },
  { value: 'traditional', label: 'Traditional' },
  { value: 'craftsman', label: 'Craftsman' },
  { value: 'colonial', label: 'Colonial' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'coastal', label: 'Coastal' },
  { value: 'farmhouse', label: 'Farmhouse' },
];

// Job specs update type
export type JobSpecs = Partial<Pick<Job,
  | 'square_footage' | 'stories' | 'bedrooms' | 'bathrooms' | 'half_baths'
  | 'garage_spaces' | 'lot_size' | 'architectural_style' | 'foundation_type'
  | 'roof_type' | 'exterior_finish' | 'hvac_system' | 'electrical_service'
  | 'plumbing_type' | 'premium_features' | 'project_manager' | 'site_supervisor'
  | 'architect' | 'engineer' | 'permit_number' | 'parcel_id' | 'flood_zone'
  | 'year_built' | 'construction_type' | 'monthly_supervision_rate'
>>;

// Job specs update mutation (uses dedicated /specs endpoint)
export function useUpdateJobSpecs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...specs }: { id: string } & JobSpecs) => {
      const response = await fetch(`/api/jobs/${id}/specs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specs),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update job specs');
      }
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      toast.success('Job specifications updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update job specs:', error);
      toast.error(`Failed to update specs: ${error.message}`);
    },
  });
}

// Dropdown options for various spec fields
export const poolTypeOptions = [
  { value: '', label: 'None' },
  { value: 'in_ground', label: 'In-Ground Pool' },
  { value: 'above_ground', label: 'Above Ground' },
  { value: 'spa', label: 'Spa Only' },
];

export const foundationTypeOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'slab', label: 'Slab on Grade' },
  { value: 'crawl', label: 'Crawl Space' },
  { value: 'basement', label: 'Basement' },
  { value: 'pier', label: 'Pier & Beam' },
  { value: 'piling', label: 'Pilings' },
];

export const roofTypeOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'shingle', label: 'Asphalt Shingle' },
  { value: 'tile', label: 'Tile' },
  { value: 'metal', label: 'Metal' },
  { value: 'flat', label: 'Flat/TPO' },
  { value: 'slate', label: 'Slate' },
];

export const exteriorFinishOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'stucco', label: 'Stucco' },
  { value: 'siding', label: 'Siding' },
  { value: 'brick', label: 'Brick' },
  { value: 'stone', label: 'Stone' },
  { value: 'hardie', label: 'HardiePlank' },
  { value: 'combo', label: 'Mixed/Combo' },
];

export const hvacSystemOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'split', label: 'Split System' },
  { value: 'package', label: 'Package Unit' },
  { value: 'mini_split', label: 'Mini-Split' },
  { value: 'geothermal', label: 'Geothermal' },
];

export const hvacFuelOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'electric', label: 'Electric' },
  { value: 'gas', label: 'Natural Gas' },
  { value: 'propane', label: 'Propane' },
  { value: 'heat_pump', label: 'Heat Pump' },
];

export const waterHeaterOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'tank', label: 'Tank' },
  { value: 'tankless', label: 'Tankless' },
  { value: 'hybrid', label: 'Hybrid/Heat Pump' },
];

export const windowFrameOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'wood', label: 'Wood' },
  { value: 'fiberglass', label: 'Fiberglass' },
  { value: 'clad', label: 'Wood Clad' },
];

export const windowGlassOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'single', label: 'Single Pane' },
  { value: 'double', label: 'Double Pane' },
  { value: 'triple', label: 'Triple Pane' },
  { value: 'low_e', label: 'Low-E' },
  { value: 'impact', label: 'Impact Rated' },
];

export const pipeMaterialOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'pex', label: 'PEX' },
  { value: 'copper', label: 'Copper' },
  { value: 'cpvc', label: 'CPVC' },
  { value: 'pvc', label: 'PVC (Drain)' },
];

export const insulationTypeOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'batt', label: 'Fiberglass Batt' },
  { value: 'blown', label: 'Blown In' },
  { value: 'spray_open', label: 'Open Cell Spray Foam' },
  { value: 'spray_closed', label: 'Closed Cell Spray Foam' },
  { value: 'rigid', label: 'Rigid Board' },
];

export const countertopOptions = [
  { value: '', label: 'Not Specified' },
  { value: 'granite', label: 'Granite' },
  { value: 'quartz', label: 'Quartz' },
  { value: 'marble', label: 'Marble' },
  { value: 'laminate', label: 'Laminate' },
  { value: 'butcher_block', label: 'Butcher Block' },
  { value: 'concrete', label: 'Concrete' },
];
