import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete, apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export type PlanSetStatus = 'current' | 'superseded' | 'archived';
export type SheetDiscipline = 'architectural' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'civil' | 'landscape' | 'interior' | 'general' | 'other';
export type RecipientType = 'vendor' | 'client' | 'internal' | 'consultant' | 'building_dept' | 'other';
export type MarkupType = 'revision_cloud' | 'comment' | 'dimension' | 'arrow' | 'text' | 'rectangle' | 'circle' | 'line' | 'highlight' | 'callout';
export type DeliveryMethod = 'email' | 'print' | 'portal' | 'link' | 'hand_delivery';

export interface PlanSet {
  id: string;
  builder_id?: string;
  job_id: string;
  name: string;
  version: number;
  description?: string;
  issue_date?: string;
  status: PlanSetStatus;
  parent_plan_set_id?: string;
  total_sheets: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  job?: { id: string; name: string; address?: string };
  parent?: { id: string; name: string; version: number };
  sheets?: PlanSheet[];
  activity?: PlanSetActivity[];
  child_versions?: Array<{ id: string; name: string; version: number; status: PlanSetStatus; created_at: string }>;
  // Computed fields
  sheet_count?: number;
  distribution_count?: number;
}

export interface PlanSheet {
  id: string;
  plan_set_id: string;
  sheet_number: string;
  sheet_name: string;
  discipline: SheetDiscipline;
  file_url: string;
  thumbnail_url?: string;
  revision: string;
  revision_date?: string;
  revision_notes?: string;
  page_size?: string;
  scale?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  // Computed fields
  markup_count?: number;
  unresolved_markups?: number;
}

export interface PlanDistribution {
  id: string;
  plan_set_id: string;
  recipient_type: RecipientType;
  recipient_id?: string;
  recipient_email?: string;
  recipient_name?: string;
  recipient_company?: string;
  sent_at?: string;
  viewed_at?: string;
  acknowledged_at?: string;
  download_count: number;
  sent_by?: string;
  delivery_method: DeliveryMethod;
  notes?: string;
  created_at: string;
  vendor?: { id: string; name: string; email?: string };
}

export interface PlanMarkup {
  id: string;
  sheet_id: string;
  markup_type: MarkupType;
  markup_data: {
    coordinates?: { x: number; y: number; width?: number; height?: number };
    points?: Array<{ x: number; y: number }>;
    text?: string;
    style?: { color?: string; stroke_width?: number; fill?: string };
    revision?: string;
    delta_number?: string;
  };
  revision?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PlanSetActivity {
  id: string;
  plan_set_id: string;
  action: string;
  performed_by?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface PlanSetStats {
  total: number;
  current: number;
  superseded: number;
  archived: number;
  total_sheets: number;
  distributions?: {
    total: number;
    viewed: number;
    acknowledged: number;
  };
}

interface PlanSetFilters {
  job_id?: string;
  status?: PlanSetStatus;
  search?: string;
  include_superseded?: boolean;
}

interface DistributeRecipient {
  recipient_type: RecipientType;
  recipient_id?: string;
  recipient_email?: string;
  recipient_name?: string;
  recipient_company?: string;
}

// ============================================================
// DISCIPLINE OPTIONS
// ============================================================

export const DISCIPLINE_OPTIONS = [
  { value: 'architectural', label: 'Architectural' },
  { value: 'structural', label: 'Structural' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'civil', label: 'Civil' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'interior', label: 'Interior' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
] as const;

export const MARKUP_TYPE_OPTIONS = [
  { value: 'revision_cloud', label: 'Revision Cloud' },
  { value: 'comment', label: 'Comment' },
  { value: 'dimension', label: 'Dimension' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'text', label: 'Text' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'callout', label: 'Callout' },
] as const;

export const RECIPIENT_TYPE_OPTIONS = [
  { value: 'vendor', label: 'Vendor/Subcontractor' },
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal Team' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'building_dept', label: 'Building Department' },
  { value: 'other', label: 'Other' },
] as const;

// ============================================================
// API FUNCTIONS
// ============================================================

async function fetchPlanSets(filters: PlanSetFilters = {}): Promise<PlanSet[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.include_superseded) params.append('include_superseded', 'true');

  const response = await apiGet(`/api/plan-sets?${params}`);
  if (!response.ok) throw new Error('Failed to fetch plan sets');
  return response.json();
}

async function fetchPlanSet(id: string): Promise<PlanSet> {
  const response = await apiGet(`/api/plan-sets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch plan set');
  return response.json();
}

async function fetchPlanSetStats(jobId?: string): Promise<PlanSetStats> {
  const params = jobId ? `?job_id=${jobId}` : '';
  const response = await apiGet(`/api/plan-sets/stats${params}`);
  if (!response.ok) throw new Error('Failed to fetch plan set stats');
  return response.json();
}

async function createPlanSet(data: {
  job_id: string;
  name: string;
  description?: string;
  issue_date?: string;
  notes?: string;
  created_by?: string;
}): Promise<PlanSet> {
  const response = await apiPost('/api/plan-sets', data);
  if (!response.ok) throw new Error('Failed to create plan set');
  return response.json();
}

async function updatePlanSet(id: string, updates: Partial<PlanSet>): Promise<PlanSet> {
  const response = await apiPatch(`/api/plan-sets/${id}`, updates);
  if (!response.ok) throw new Error('Failed to update plan set');
  return response.json();
}

async function deletePlanSet(id: string): Promise<void> {
  const response = await apiDelete(`/api/plan-sets/${id}`);
  if (!response.ok) throw new Error('Failed to delete plan set');
}

async function createNewVersion(id: string, data: {
  description?: string;
  issue_date?: string;
  notes?: string;
  created_by?: string;
}): Promise<PlanSet> {
  const response = await apiPost(`/api/plan-sets/${id}/new-version`, data);
  if (!response.ok) throw new Error('Failed to create new version');
  return response.json();
}

// Sheets
async function fetchSheets(planSetId: string, discipline?: SheetDiscipline): Promise<PlanSheet[]> {
  const params = discipline ? `?discipline=${discipline}` : '';
  const response = await apiGet(`/api/plan-sets/${planSetId}/sheets${params}`);
  if (!response.ok) throw new Error('Failed to fetch sheets');
  return response.json();
}

async function addSheet(planSetId: string, formData: FormData): Promise<PlanSheet> {
  const response = await apiFetch(`/api/plan-sets/${planSetId}/sheets`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to add sheet');
  return response.json();
}

async function updateSheet(planSetId: string, sheetId: string, updates: Partial<PlanSheet>): Promise<PlanSheet> {
  const response = await apiPatch(`/api/plan-sets/${planSetId}/sheets/${sheetId}`, updates);
  if (!response.ok) throw new Error('Failed to update sheet');
  return response.json();
}

async function deleteSheet(planSetId: string, sheetId: string): Promise<void> {
  const response = await apiDelete(`/api/plan-sets/${planSetId}/sheets/${sheetId}`);
  if (!response.ok) throw new Error('Failed to delete sheet');
}

async function uploadThumbnail(planSetId: string, sheetId: string, formData: FormData): Promise<PlanSheet> {
  const response = await apiFetch(`/api/plan-sets/${planSetId}/sheets/${sheetId}/thumbnail`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload thumbnail');
  return response.json();
}

// Distributions
async function fetchDistributions(planSetId: string): Promise<PlanDistribution[]> {
  const response = await apiGet(`/api/plan-sets/${planSetId}/distributions`);
  if (!response.ok) throw new Error('Failed to fetch distributions');
  return response.json();
}

async function distribute(planSetId: string, data: {
  recipients: DistributeRecipient[];
  delivery_method?: DeliveryMethod;
  notes?: string;
  sent_by?: string;
}): Promise<{ success: boolean; message: string; distributions: PlanDistribution[] }> {
  const response = await apiPost(`/api/plan-sets/${planSetId}/distribute`, data);
  if (!response.ok) throw new Error('Failed to distribute plan set');
  return response.json();
}

async function updateDistribution(distributionId: string, updates: Partial<PlanDistribution>): Promise<PlanDistribution> {
  const response = await apiPatch(`/api/plan-sets/distributions/${distributionId}`, updates);
  if (!response.ok) throw new Error('Failed to update distribution');
  return response.json();
}

async function deleteDistribution(distributionId: string): Promise<void> {
  const response = await apiDelete(`/api/plan-sets/distributions/${distributionId}`);
  if (!response.ok) throw new Error('Failed to delete distribution');
}

// Markups
async function fetchMarkups(sheetId: string, options?: { markup_type?: MarkupType; resolved?: boolean }): Promise<PlanMarkup[]> {
  const params = new URLSearchParams();
  if (options?.markup_type) params.append('markup_type', options.markup_type);
  if (options?.resolved !== undefined) params.append('resolved', String(options.resolved));

  const response = await apiGet(`/api/plan-sets/sheets/${sheetId}/markups?${params}`);
  if (!response.ok) throw new Error('Failed to fetch markups');
  return response.json();
}

async function createMarkup(sheetId: string, data: {
  markup_type: MarkupType;
  markup_data?: PlanMarkup['markup_data'];
  revision?: string;
  created_by?: string;
}): Promise<PlanMarkup> {
  const response = await apiPost(`/api/plan-sets/sheets/${sheetId}/markups`, data);
  if (!response.ok) throw new Error('Failed to create markup');
  return response.json();
}

async function updateMarkup(markupId: string, updates: Partial<PlanMarkup>): Promise<PlanMarkup> {
  const response = await apiPatch(`/api/plan-sets/markups/${markupId}`, updates);
  if (!response.ok) throw new Error('Failed to update markup');
  return response.json();
}

async function deleteMarkup(markupId: string): Promise<void> {
  const response = await apiDelete(`/api/plan-sets/markups/${markupId}`);
  if (!response.ok) throw new Error('Failed to delete markup');
}

// Version history
async function fetchVersionHistory(planSetId: string): Promise<Array<{
  id: string;
  name: string;
  version: number;
  status: PlanSetStatus;
  issue_date?: string;
  total_sheets: number;
  created_at: string;
  created_by?: string;
}>> {
  const response = await apiGet(`/api/plan-sets/${planSetId}/versions`);
  if (!response.ok) throw new Error('Failed to fetch version history');
  return response.json();
}

// Activity
async function fetchActivity(planSetId: string, limit?: number): Promise<PlanSetActivity[]> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await apiGet(`/api/plan-sets/${planSetId}/activity${params}`);
  if (!response.ok) throw new Error('Failed to fetch activity');
  return response.json();
}

// ============================================================
// HOOKS
// ============================================================

export function usePlanSets(filters: PlanSetFilters = {}) {
  return useQuery({
    queryKey: ['plan-sets', filters],
    queryFn: () => fetchPlanSets(filters),
  });
}

export function usePlanSet(id?: string) {
  return useQuery({
    queryKey: ['plan-set', id],
    queryFn: () => fetchPlanSet(id!),
    enabled: !!id,
  });
}

export function usePlanSetStats(jobId?: string) {
  return useQuery({
    queryKey: ['plan-set-stats', jobId],
    queryFn: () => fetchPlanSetStats(jobId),
  });
}

export function useCreatePlanSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlanSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
      queryClient.invalidateQueries({ queryKey: ['plan-set-stats'] });
    },
  });
}

export function useUpdatePlanSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PlanSet> }) =>
      updatePlanSet(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', id] });
      queryClient.invalidateQueries({ queryKey: ['plan-set-stats'] });
    },
  });
}

export function useDeletePlanSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlanSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
      queryClient.invalidateQueries({ queryKey: ['plan-set-stats'] });
    },
  });
}

export function useCreateNewVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof createNewVersion>[1] }) =>
      createNewVersion(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', id] });
      queryClient.invalidateQueries({ queryKey: ['plan-set-stats'] });
    },
  });
}

// Sheets
export function useSheets(planSetId?: string, discipline?: SheetDiscipline) {
  return useQuery({
    queryKey: ['plan-sheets', planSetId, discipline],
    queryFn: () => fetchSheets(planSetId!, discipline),
    enabled: !!planSetId,
  });
}

export function useAddSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planSetId, formData }: { planSetId: string; formData: FormData }) =>
      addSheet(planSetId, formData),
    onSuccess: (_, { planSetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sheets', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
    },
  });
}

export function useUpdateSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planSetId, sheetId, updates }: { planSetId: string; sheetId: string; updates: Partial<PlanSheet> }) =>
      updateSheet(planSetId, sheetId, updates),
    onSuccess: (_, { planSetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sheets', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', planSetId] });
    },
  });
}

export function useDeleteSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planSetId, sheetId }: { planSetId: string; sheetId: string }) =>
      deleteSheet(planSetId, sheetId),
    onSuccess: (_, { planSetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sheets', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
    },
  });
}

export function useUploadThumbnail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planSetId, sheetId, formData }: { planSetId: string; sheetId: string; formData: FormData }) =>
      uploadThumbnail(planSetId, sheetId, formData),
    onSuccess: (_, { planSetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-sheets', planSetId] });
    },
  });
}

// Distributions
export function useDistributions(planSetId?: string) {
  return useQuery({
    queryKey: ['plan-distributions', planSetId],
    queryFn: () => fetchDistributions(planSetId!),
    enabled: !!planSetId,
  });
}

export function useDistribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planSetId, data }: { planSetId: string; data: Parameters<typeof distribute>[1] }) =>
      distribute(planSetId, data),
    onSuccess: (_, { planSetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-distributions', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-set', planSetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
    },
  });
}

export function useUpdateDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ distributionId, updates }: { distributionId: string; updates: Partial<PlanDistribution> }) =>
      updateDistribution(distributionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-distributions'] });
    },
  });
}

export function useDeleteDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDistribution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['plan-sets'] });
    },
  });
}

// Markups
export function useMarkups(sheetId?: string, options?: { markup_type?: MarkupType; resolved?: boolean }) {
  return useQuery({
    queryKey: ['plan-markups', sheetId, options],
    queryFn: () => fetchMarkups(sheetId!, options),
    enabled: !!sheetId,
  });
}

export function useCreateMarkup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, data }: { sheetId: string; data: Parameters<typeof createMarkup>[1] }) =>
      createMarkup(sheetId, data),
    onSuccess: (_, { sheetId }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-markups', sheetId] });
      queryClient.invalidateQueries({ queryKey: ['plan-sheets'] });
    },
  });
}

export function useUpdateMarkup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ markupId, updates }: { markupId: string; updates: Partial<PlanMarkup> }) =>
      updateMarkup(markupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-markups'] });
      queryClient.invalidateQueries({ queryKey: ['plan-sheets'] });
    },
  });
}

export function useDeleteMarkup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMarkup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-markups'] });
      queryClient.invalidateQueries({ queryKey: ['plan-sheets'] });
    },
  });
}

// Version history
export function useVersionHistory(planSetId?: string) {
  return useQuery({
    queryKey: ['plan-set-versions', planSetId],
    queryFn: () => fetchVersionHistory(planSetId!),
    enabled: !!planSetId,
  });
}

// Activity
export function usePlanSetActivity(planSetId?: string, limit?: number) {
  return useQuery({
    queryKey: ['plan-set-activity', planSetId, limit],
    queryFn: () => fetchActivity(planSetId!, limit),
    enabled: !!planSetId,
  });
}
