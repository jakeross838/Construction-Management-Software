import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================
// TYPES
// ============================================================

export interface DocumentMetadata {
  id: string;
  document_id: string;
  extracted_text: string | null;
  extracted_at: string | null;
  extraction_method: 'pdf-parse' | 'ocr' | 'manual' | null;
  page_count: number | null;
  word_count: number | null;
  ai_category: string | null;
  ai_category_confidence: number | null;
  ai_suggested_tags: string[] | null;
  expiration_date: string | null;
  expiration_type: 'insurance' | 'license' | 'permit' | 'warranty' | 'contract' | 'certification' | 'bond' | 'other' | null;
  expiration_notes: string | null;
  alert_days_before: number[] | null;
  last_extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAlert {
  id: string;
  document_id: string;
  alert_type: 'expiring_soon' | 'expired' | 'missing_required' | 'needs_review' | 'extraction_failed';
  alert_date: string;
  days_until_expiry: number | null;
  title: string;
  message: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
  document?: {
    id: string;
    title: string;
    file_url: string;
    job?: { id: string; name: string };
    vendor?: { id: string; name: string };
  };
}

export interface SearchResult {
  document_id: string;
  document_title: string;
  job_id: string | null;
  job_name: string | null;
  category: string | null;
  file_url: string;
  expiration_date: string | null;
  expiration_type: string | null;
  matched_text: string;
  relevance_score: number;
  created_at: string;
}

export interface ExpiringDocument {
  document_id: string;
  document_title: string;
  job_id: string | null;
  job_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  file_url: string;
  expiration_date: string;
  expiration_type: string | null;
  days_until_expiry: number;
  alert_status: 'expired' | 'expiring_soon' | 'valid';
}

export interface AlertCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DocumentIntelligenceStats {
  documents: {
    total: number;
    processed: number;
    percentProcessed: number;
  };
  expiration: {
    tracked: number;
    byType: Record<string, number>;
  };
  alerts: {
    active: number;
  };
  categories: Record<string, number>;
}

// ============================================================
// API FUNCTIONS
// ============================================================

async function extractDocument(documentId: string, force = false): Promise<{ success: boolean; result?: object }> {
  const response = await fetch(`/api/document-intelligence/${documentId}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  if (!response.ok) throw new Error('Failed to extract document');
  return response.json();
}

async function fetchDocumentMetadata(documentId: string): Promise<{ metadata: DocumentMetadata | null }> {
  const response = await fetch(`/api/document-intelligence/${documentId}/metadata`);
  if (!response.ok) throw new Error('Failed to fetch metadata');
  return response.json();
}

async function updateDocumentMetadata(
  documentId: string,
  updates: Partial<Pick<DocumentMetadata, 'expiration_date' | 'expiration_type' | 'expiration_notes' | 'alert_days_before' | 'ai_suggested_tags'>>
): Promise<{ success: boolean; metadata: DocumentMetadata }> {
  const response = await fetch(`/api/document-intelligence/${documentId}/metadata`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update metadata');
  return response.json();
}

async function searchDocuments(
  query: string,
  filters: { jobId?: string; category?: string; expirationType?: string; limit?: number } = {}
): Promise<{ results: SearchResult[]; count: number }> {
  const params = new URLSearchParams({ q: query });
  if (filters.jobId) params.append('job_id', filters.jobId);
  if (filters.category) params.append('category', filters.category);
  if (filters.expirationType) params.append('expiration_type', filters.expirationType);
  if (filters.limit) params.append('limit', String(filters.limit));

  const response = await fetch(`/api/document-intelligence/search?${params}`);
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}

async function fetchExpiringDocuments(
  days = 30,
  filters: { jobId?: string; expirationType?: string } = {}
): Promise<{ expired: ExpiringDocument[]; expiringSoon: ExpiringDocument[]; all: ExpiringDocument[]; summary: { total: number; expired: number; expiringSoon: number } }> {
  const params = new URLSearchParams({ days: String(days) });
  if (filters.jobId) params.append('job_id', filters.jobId);
  if (filters.expirationType) params.append('expiration_type', filters.expirationType);

  const response = await fetch(`/api/document-intelligence/expiring?${params}`);
  if (!response.ok) throw new Error('Failed to fetch expiring documents');
  return response.json();
}

async function fetchExpiringSummary(days = 90): Promise<{ byType: Record<string, { expired: number; expiringSoon: number; total: number }>; byStatus: { expired: number; expiring_soon: number }; total: number }> {
  const response = await fetch(`/api/document-intelligence/expiring/summary?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch expiring summary');
  return response.json();
}

async function fetchAlerts(
  filters: { documentId?: string; alertType?: string; limit?: number } = {}
): Promise<{ alerts: DocumentAlert[]; count: number; bySeverity: AlertCounts }> {
  const params = new URLSearchParams();
  if (filters.documentId) params.append('document_id', filters.documentId);
  if (filters.alertType) params.append('alert_type', filters.alertType);
  if (filters.limit) params.append('limit', String(filters.limit));

  const response = await fetch(`/api/document-intelligence/alerts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

async function fetchAlertCounts(): Promise<AlertCounts> {
  const response = await fetch('/api/document-intelligence/alerts/count');
  if (!response.ok) throw new Error('Failed to fetch alert counts');
  return response.json();
}

async function acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<{ success: boolean; alert: DocumentAlert }> {
  const response = await fetch(`/api/document-intelligence/alerts/${alertId}/acknowledge`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
  });
  if (!response.ok) throw new Error('Failed to acknowledge alert');
  return response.json();
}

async function dismissAlert(alertId: string): Promise<{ success: boolean; alert: DocumentAlert }> {
  const response = await fetch(`/api/document-intelligence/alerts/${alertId}/dismiss`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to dismiss alert');
  return response.json();
}

async function acknowledgeAlertsBulk(alertIds: string[], acknowledgedBy?: string): Promise<{ success: boolean; acknowledged: number }> {
  const response = await fetch('/api/document-intelligence/alerts/acknowledge-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_ids: alertIds, acknowledged_by: acknowledgedBy }),
  });
  if (!response.ok) throw new Error('Failed to acknowledge alerts');
  return response.json();
}

async function processDocumentBatch(options: { documentIds?: string[]; jobId?: string }): Promise<{ success: boolean; processed: number; failed: number; skipped: number; errors: Array<{ documentId: string; error: string }> }> {
  const response = await fetch('/api/document-intelligence/process-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: options.documentIds, job_id: options.jobId }),
  });
  if (!response.ok) throw new Error('Failed to process batch');
  return response.json();
}

async function generateAlerts(): Promise<{ success: boolean; alertsGenerated: number }> {
  const response = await fetch('/api/document-intelligence/generate-alerts', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate alerts');
  return response.json();
}

async function fetchStats(): Promise<{ stats: DocumentIntelligenceStats }> {
  const response = await fetch('/api/document-intelligence/stats');
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Extract text and metadata from a document
 */
export function useExtractDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, force }: { documentId: string; force?: boolean }) =>
      extractDocument(documentId, force),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['document-metadata', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-intelligence-stats'] });
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
    },
  });
}

/**
 * Get metadata for a specific document
 */
export function useDocumentMetadata(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-metadata', documentId],
    queryFn: () => fetchDocumentMetadata(documentId!),
    enabled: !!documentId,
    select: (data) => data.metadata,
  });
}

/**
 * Update document metadata (expiration date, type, etc.)
 */
export function useUpdateDocumentMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, updates }: { documentId: string; updates: Partial<DocumentMetadata> }) =>
      updateDocumentMetadata(documentId, updates),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['document-metadata', documentId] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
    },
  });
}

/**
 * Search documents by content
 */
export function useDocumentSearch(
  query: string,
  filters: { jobId?: string; category?: string; expirationType?: string; limit?: number } = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ['document-search', query, filters],
    queryFn: () => searchDocuments(query, filters),
    enabled: options.enabled !== false && query.length >= 2,
    select: (data) => data.results,
  });
}

/**
 * Get documents expiring within specified days
 */
export function useExpiringDocuments(
  days = 30,
  filters: { jobId?: string; expirationType?: string } = {}
) {
  return useQuery({
    queryKey: ['expiring-documents', days, filters],
    queryFn: () => fetchExpiringDocuments(days, filters),
  });
}

/**
 * Get summary of expiring documents grouped by type
 */
export function useExpiringSummary(days = 90) {
  return useQuery({
    queryKey: ['expiring-summary', days],
    queryFn: () => fetchExpiringSummary(days),
  });
}

/**
 * Get active document alerts
 */
export function useDocumentAlerts(
  filters: { documentId?: string; alertType?: string; limit?: number } = {}
) {
  return useQuery({
    queryKey: ['document-alerts', filters],
    queryFn: () => fetchAlerts(filters),
  });
}

/**
 * Get alert counts for badges/notifications
 */
export function useAlertCounts() {
  return useQuery({
    queryKey: ['document-alert-counts'],
    queryFn: fetchAlertCounts,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Acknowledge a single alert
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, acknowledgedBy }: { alertId: string; acknowledgedBy?: string }) =>
      acknowledgeAlert(alertId, acknowledgedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['document-alert-counts'] });
    },
  });
}

/**
 * Dismiss an alert
 */
export function useDismissAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['document-alert-counts'] });
    },
  });
}

/**
 * Acknowledge multiple alerts at once
 */
export function useAcknowledgeAlertsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertIds, acknowledgedBy }: { alertIds: string[]; acknowledgedBy?: string }) =>
      acknowledgeAlertsBulk(alertIds, acknowledgedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['document-alert-counts'] });
    },
  });
}

/**
 * Process multiple documents for intelligence extraction
 */
export function useProcessDocumentBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: processDocumentBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['document-intelligence-stats'] });
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
    },
  });
}

/**
 * Manually trigger alert generation
 */
export function useGenerateAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['document-alert-counts'] });
    },
  });
}

/**
 * Get document intelligence statistics
 */
export function useDocumentIntelligenceStats() {
  return useQuery({
    queryKey: ['document-intelligence-stats'],
    queryFn: fetchStats,
    select: (data) => data.stats,
  });
}

// ============================================================
// CONSTANTS
// ============================================================

export const EXPIRATION_TYPES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'license', label: 'License' },
  { value: 'permit', label: 'Permit' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'contract', label: 'Contract' },
  { value: 'certification', label: 'Certification' },
  { value: 'bond', label: 'Bond' },
  { value: 'other', label: 'Other' },
] as const;

export const ALERT_SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'red' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Low', color: 'blue' },
] as const;

export const DEFAULT_ALERT_DAYS = [30, 14, 7];
