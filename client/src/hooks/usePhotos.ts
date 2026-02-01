import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export type PhotoCategory = 'progress' | 'exterior' | 'interior' | 'detail' | 'issue' | 'completion';

export interface Photo {
  id: string;
  job_id: string;
  file_url: string;
  file_name: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  location: string | null;
  category: PhotoCategory;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  uploaded_by: string | null;
  created_at: string;
  job?: { id: string; name: string; address?: string };
  links?: PhotoLink[];
  activity?: PhotoActivity[];
}

export interface PhotoLink {
  id: string;
  photo_id: string;
  entity_type: 'inspection' | 'punch_item' | 'daily_log';
  entity_id: string;
  created_at: string;
}

export interface PhotoActivity {
  id: string;
  photo_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface PhotoStats {
  total: number;
  by_category: Record<string, number>;
  by_month: Record<string, number>;
}

export interface PhotosResponse {
  data: Photo[];
  count: number;
}

export interface PhotoFilters {
  job_id?: string;
  category?: PhotoCategory;
  search?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// ========================
// QUERIES
// ========================

export function usePhotos(filters?: PhotoFilters) {
  return useQuery({
    queryKey: ['photos', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.start_date) params.set('start_date', filters.start_date);
      if (filters?.end_date) params.set('end_date', filters.end_date);
      if (filters?.limit) params.set('limit', filters.limit.toString());
      if (filters?.offset) params.set('offset', filters.offset.toString());
      const queryString = params.toString();
      const endpoint = queryString ? `/photos?${queryString}` : '/photos';
      return api<PhotosResponse>(endpoint);
    },
  });
}

export function usePhoto(id: string | null) {
  return useQuery({
    queryKey: ['photo', id],
    queryFn: async () => {
      if (!id) return null;
      return api<Photo>(`/photos/${id}`);
    },
    enabled: !!id,
  });
}

export function usePhotoStats(jobId?: string) {
  return useQuery({
    queryKey: ['photo-stats', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/photos/stats?job_id=${jobId}` : '/photos/stats';
      return api<PhotoStats>(endpoint);
    },
  });
}

export function usePhotosByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['photos-by-entity', entityType, entityId],
    queryFn: async () => {
      return api<Photo[]>(`/photos/by-entity/${entityType}/${entityId}`);
    },
    enabled: !!entityType && !!entityId,
  });
}

// ========================
// MUTATIONS
// ========================

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      file: File;
      job_id: string;
      caption?: string;
      location?: string;
      category?: PhotoCategory;
      taken_at?: string;
      uploaded_by?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('job_id', data.job_id);
      if (data.caption) formData.append('caption', data.caption);
      if (data.location) formData.append('location', data.location);
      if (data.category) formData.append('category', data.category);
      if (data.taken_at) formData.append('taken_at', data.taken_at);
      if (data.uploaded_by) formData.append('uploaded_by', data.uploaded_by);

      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || 'Upload failed');
      }

      return response.json() as Promise<Photo>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo-stats'] });
      toast.success('Photo uploaded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });
}

export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      caption?: string;
      location?: string;
      category?: PhotoCategory;
      taken_at?: string;
      updated_by?: string;
    }) =>
      api<Photo>(`/photos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo', data.id] });
      toast.success('Photo updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update photo: ${error.message}`);
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/photos/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo-stats'] });
      toast.success('Photo deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });
}

export function useLinkPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, entity_type, entity_id, created_by }: {
      photoId: string;
      entity_type: 'inspection' | 'punch_item' | 'daily_log';
      entity_id: string;
      created_by?: string;
    }) =>
      api<PhotoLink>(`/photos/${photoId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type, entity_id, created_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photo', variables.photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos-by-entity'] });
      toast.success('Photo linked');
    },
    onError: (error: Error) => {
      toast.error(`Failed to link photo: ${error.message}`);
    },
  });
}

export function useUnlinkPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, linkId }: { photoId: string; linkId: string }) =>
      api(`/photos/${photoId}/links/${linkId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photo', variables.photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos-by-entity'] });
      toast.success('Link removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove link: ${error.message}`);
    },
  });
}

// ========================
// HELPERS
// ========================

export const photoCategoryConfig: Record<PhotoCategory, { label: string; color: string; bgColor: string }> = {
  progress: { label: 'Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  exterior: { label: 'Exterior', color: 'text-green-600', bgColor: 'bg-green-100' },
  interior: { label: 'Interior', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  detail: { label: 'Detail', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  issue: { label: 'Issue', color: 'text-red-600', bgColor: 'bg-red-100' },
  completion: { label: 'Completion', color: 'text-teal-600', bgColor: 'bg-teal-100' },
};
