import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Types
export type WeatherType = 'rain' | 'wind' | 'snow' | 'extreme_heat' | 'extreme_cold' | 'storm' | 'other';

export interface WeatherDelay {
  id: string;
  job_id: string;
  schedule_task_id: string | null;
  delay_date: string;
  weather_type: WeatherType;
  delay_hours: number;
  impact_description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  job?: { id: string; name: string };
  schedule_task?: { id: string; name: string } | null;
}

export interface WeatherDelaySummary {
  total_delay_hours: number;
  total_delay_days: number;
  delay_count: number;
  affected_task_count: number;
  by_weather_type: Record<WeatherType, { count: number; hours: number }>;
  by_month: Record<string, { count: number; hours: number }>;
}

export interface CreateWeatherDelayInput {
  job_id: string;
  schedule_task_id?: string | null;
  delay_date: string;
  weather_type: WeatherType;
  delay_hours: number;
  impact_description?: string;
  created_by?: string;
}

export interface UpdateWeatherDelayInput {
  id: string;
  schedule_task_id?: string | null;
  delay_date?: string;
  weather_type?: WeatherType;
  delay_hours?: number;
  impact_description?: string;
}

// ========================
// QUERIES
// ========================

export function useWeatherDelays(
  jobId: string | null,
  options?: { startDate?: string; endDate?: string; weatherType?: WeatherType }
) {
  return useQuery({
    queryKey: ['weather-delays', jobId, options],
    queryFn: async () => {
      if (!jobId) return [];
      const params = new URLSearchParams({ job_id: jobId });
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);
      if (options?.weatherType) params.append('weather_type', options.weatherType);
      return api<WeatherDelay[]>(`/weather-delays?${params}`);
    },
    enabled: !!jobId,
  });
}

export function useWeatherDelay(id: string | null) {
  return useQuery({
    queryKey: ['weather-delay', id],
    queryFn: async () => {
      if (!id) return null;
      return api<WeatherDelay>(`/weather-delays/${id}`);
    },
    enabled: !!id,
  });
}

export function useWeatherDelaySummary(
  jobId: string | null,
  options?: { startDate?: string; endDate?: string }
) {
  return useQuery({
    queryKey: ['weather-delay-summary', jobId, options],
    queryFn: async () => {
      if (!jobId) return null;
      const params = new URLSearchParams({ job_id: jobId });
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);
      return api<WeatherDelaySummary>(`/weather-delays/summary?${params}`);
    },
    enabled: !!jobId,
  });
}

// ========================
// MUTATIONS
// ========================

export function useCreateWeatherDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWeatherDelayInput) => {
      return api<WeatherDelay>('/weather-delays', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weather-delays', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['weather-delay-summary', data.job_id] });
      toast.success('Weather delay recorded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record weather delay: ${error.message}`);
    },
  });
}

export function useUpdateWeatherDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateWeatherDelayInput) => {
      return api<WeatherDelay>(`/weather-delays/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weather-delays', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['weather-delay', data.id] });
      queryClient.invalidateQueries({ queryKey: ['weather-delay-summary', data.job_id] });
      toast.success('Weather delay updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update weather delay: ${error.message}`);
    },
  });
}

export function useDeleteWeatherDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      await api(`/weather-delays/${id}`, { method: 'DELETE' });
      return { id, jobId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weather-delays', data.jobId] });
      queryClient.invalidateQueries({ queryKey: ['weather-delay-summary', data.jobId] });
      toast.success('Weather delay deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete weather delay: ${error.message}`);
    },
  });
}

// ========================
// HELPERS
// ========================

export const weatherTypeConfig: Record<WeatherType, { label: string; icon: string; color: string; bgColor: string }> = {
  rain: { label: 'Rain', icon: 'cloud-rain', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  wind: { label: 'High Wind', icon: 'wind', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  snow: { label: 'Snow/Ice', icon: 'snowflake', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  extreme_heat: { label: 'Extreme Heat', icon: 'sun', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  extreme_cold: { label: 'Extreme Cold', icon: 'thermometer-snow', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  storm: { label: 'Storm', icon: 'cloud-lightning', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  other: { label: 'Other', icon: 'cloud', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

export const weatherTypeOptions = Object.entries(weatherTypeConfig).map(([value, config]) => ({
  value: value as WeatherType,
  label: config.label,
}));

/**
 * Convert delay hours to a human-readable format
 */
export function formatDelayHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours === 1) {
    return '1 hour';
  }
  if (hours < 8) {
    return `${hours} hours`;
  }
  const days = hours / 8;
  if (days === 1) {
    return '1 work day';
  }
  return `${days.toFixed(1)} work days`;
}

/**
 * Calculate total delay impact message
 */
export function getDelayImpactMessage(summary: WeatherDelaySummary): string {
  if (summary.delay_count === 0) {
    return 'No weather delays recorded';
  }

  const parts: string[] = [];
  parts.push(`${summary.delay_count} weather delay${summary.delay_count === 1 ? '' : 's'}`);
  parts.push(`totaling ${summary.total_delay_days} work day${summary.total_delay_days === 1 ? '' : 's'}`);

  if (summary.affected_task_count > 0) {
    parts.push(`affecting ${summary.affected_task_count} task${summary.affected_task_count === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}
