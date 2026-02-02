import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Document {
  id: string;
  job_id: string;
  name: string;
  description?: string;
  category: 'contracts' | 'plans' | 'permits' | 'insurance' | 'proposals' | 'specs' | 'invoices' | 'warranties' | 'correspondence' | 'photos' | 'other';
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  document_date?: string;
  expiration_date?: string;
  tags?: string[];
  vendor_id?: string;
  po_id?: string;
  invoice_id?: string;
  folder_id?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  job?: { id: string; name: string };
  vendor?: { id: string; name: string };
  folder?: { id: string; name: string };
}

export interface DocumentFolder {
  id: string;
  job_id: string;
  name: string;
  description?: string;
  parent_folder_id?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  document_count?: number;
  subfolder_count?: number;
  job?: { id: string; name: string };
  parent?: { id: string; name: string };
  path?: Array<{ id: string; name: string; level: number }>;
}

export interface DocumentStats {
  total: number;
  by_category: Record<string, number>;
  expiring_soon: Array<{ id: string; name: string; expiration_date: string }>;
}

interface DocumentFilters {
  job_id?: string;
  category?: string;
  vendor_id?: string;
  folder_id?: string;
  search?: string;
  include_deleted?: boolean;
}

interface FolderFilters {
  job_id: string;
  parent_folder_id?: string | null;
  include_deleted?: boolean;
}

export const DOCUMENT_CATEGORIES = [
  { id: 'contracts', name: 'Contracts & Agreements' },
  { id: 'plans', name: 'Plans & Drawings' },
  { id: 'permits', name: 'Permits & Approvals' },
  { id: 'insurance', name: 'Insurance & Bonds' },
  { id: 'proposals', name: 'Proposals & Bids' },
  { id: 'specs', name: 'Specifications' },
  { id: 'invoices', name: 'Invoices & Billing' },
  { id: 'warranties', name: 'Warranties' },
  { id: 'correspondence', name: 'Correspondence' },
  { id: 'photos', name: 'Photos' },
  { id: 'other', name: 'Other' },
] as const;

async function fetchDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.category) params.append('category', filters.category);
  if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
  if (filters.folder_id) params.append('folder_id', filters.folder_id);
  if (filters.search) params.append('search', filters.search);
  if (filters.include_deleted) params.append('include_deleted', 'true');

  const response = await fetch(`/api/documents?${params}`);
  if (!response.ok) throw new Error('Failed to fetch documents');
  return response.json();
}

async function fetchDocumentStats(jobId: string): Promise<DocumentStats> {
  const response = await fetch(`/api/documents/stats/${jobId}`);
  if (!response.ok) throw new Error('Failed to fetch document stats');
  return response.json();
}

async function fetchDocument(id: string): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`);
  if (!response.ok) throw new Error('Failed to fetch document');
  return response.json();
}

async function uploadDocument(formData: FormData): Promise<Document> {
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload document');
  return response.json();
}

async function updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update document');
  return response.json();
}

async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete document');
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => fetchDocuments(filters),
  });
}

export function useDocumentStats(jobId?: string) {
  return useQuery({
    queryKey: ['document-stats', jobId],
    queryFn: () => fetchDocumentStats(jobId!),
    enabled: !!jobId,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Document> }) =>
      updateDocument(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    },
  });
}

// ============================================================
// FOLDER API FUNCTIONS
// ============================================================

async function fetchFolders(filters: FolderFilters): Promise<DocumentFolder[]> {
  const params = new URLSearchParams();
  params.append('job_id', filters.job_id);
  if (filters.parent_folder_id !== undefined) {
    params.append('parent_folder_id', filters.parent_folder_id === null ? 'null' : filters.parent_folder_id);
  }
  if (filters.include_deleted) params.append('include_deleted', 'true');

  const response = await fetch(`/api/documents/folders?${params}`);
  if (!response.ok) throw new Error('Failed to fetch folders');
  return response.json();
}

async function fetchFolder(id: string): Promise<DocumentFolder> {
  const response = await fetch(`/api/documents/folders/${id}`);
  if (!response.ok) throw new Error('Failed to fetch folder');
  return response.json();
}

async function createFolder(data: {
  job_id: string;
  name: string;
  description?: string;
  parent_folder_id?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  created_by?: string;
}): Promise<DocumentFolder> {
  const response = await fetch('/api/documents/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create folder');
  }
  return response.json();
}

async function updateFolder(id: string, updates: Partial<DocumentFolder>): Promise<DocumentFolder> {
  const response = await fetch(`/api/documents/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update folder');
  }
  return response.json();
}

async function deleteFolder(id: string, recursive = false): Promise<void> {
  const response = await fetch(`/api/documents/folders/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recursive }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete folder');
  }
}

async function moveDocument(documentId: string, folderId: string | null): Promise<Document> {
  const response = await fetch(`/api/documents/${documentId}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!response.ok) throw new Error('Failed to move document');
  return response.json();
}

async function moveDocumentsBulk(documentIds: string[], folderId: string | null): Promise<{ success: boolean; moved: number }> {
  const response = await fetch('/api/documents/move-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds, folder_id: folderId }),
  });
  if (!response.ok) throw new Error('Failed to move documents');
  return response.json();
}

// ============================================================
// FOLDER HOOKS
// ============================================================

export function useFolders(filters: FolderFilters) {
  return useQuery({
    queryKey: ['document-folders', filters],
    queryFn: () => fetchFolders(filters),
    enabled: !!filters.job_id,
  });
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: ['document-folder', id],
    queryFn: () => fetchFolder(id),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DocumentFolder> }) =>
      updateFolder(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['document-folder', id] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recursive = false }: { id: string; recursive?: boolean }) =>
      deleteFolder(id, recursive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, folderId }: { documentId: string; folderId: string | null }) =>
      moveDocument(documentId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
    },
  });
}

export function useMoveDocumentsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentIds, folderId }: { documentIds: string[]; folderId: string | null }) =>
      moveDocumentsBulk(documentIds, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
    },
  });
}
