/**
 * Time Clock Hook for Mobile PWA
 * Phase 1.1b: Time tracking with GPS
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, apiPost } from '@/lib/api';

interface TimeClockEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_update: string | null;
  tracking_status: 'active' | 'paused' | 'stopped';
  total_hours: number | null;
  total_break_minutes: number | null;
  notes: string | null;
  job?: { id: string; name: string } | null;
  breaks?: TimeClockBreak[];
}

interface TimeClockBreak {
  id: string;
  time_clock_entry_id: string;
  break_start_time: string;
  break_end_time: string | null;
  duration_minutes: number | null;
  break_type: 'lunch' | 'rest' | 'other';
}

interface TimeClockStatus {
  clocked_in: boolean;
  entry: TimeClockEntry | null;
  active_break: TimeClockBreak | null;
  elapsed_minutes: number;
  break_minutes: number;
  working_minutes: number;
}

interface TimeClockSummary {
  today: { hours: number; entries: number };
  week: { hours: number; entries: number };
}

interface UseTimeClockReturn {
  status: TimeClockStatus | null;
  summary: TimeClockSummary | null;
  history: TimeClockEntry[];
  loading: boolean;
  error: string | null;
  clockIn: (jobId?: string, latitude?: number, longitude?: number, notes?: string) => Promise<boolean>;
  clockOut: (latitude?: number, longitude?: number, notes?: string) => Promise<boolean>;
  startBreak: (breakType?: 'lunch' | 'rest' | 'other') => Promise<boolean>;
  endBreak: () => Promise<boolean>;
  updateLocation: (latitude: number, longitude: number, accuracy?: number) => Promise<boolean>;
  refresh: () => Promise<void>;
  elapsedTime: string;
}

const API_BASE = '/api/mobile/timeclock';

export function useTimeClock(): UseTimeClockReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [summary, setSummary] = useState<TimeClockSummary | null>(null);
  const [history, setHistory] = useState<TimeClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format elapsed time from minutes
  const formatElapsedTime = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get custom headers (x-user-id for mobile identification)
  const getCustomHeaders = useCallback(() => {
    return {
      'x-user-id': user?.id || '',
    };
  }, [user?.id]);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_BASE}/status`, {
        headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      console.error('Error fetching time clock status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [getCustomHeaders]);

  // Fetch summary stats
  const fetchSummary = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_BASE}/summary`, {
        headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
      });
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      setSummary(data);
      return data;
    } catch (err) {
      console.error('Error fetching time clock summary:', err);
      return null;
    }
  }, [getCustomHeaders]);

  // Fetch history
  const fetchHistory = useCallback(async (limit = 10) => {
    try {
      const response = await apiFetch(`${API_BASE}/history?limit=${limit}`, {
        headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
      });
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data.entries || []);
      return data.entries || [];
    } catch (err) {
      console.error('Error fetching time clock history:', err);
      return [];
    }
  }, [getCustomHeaders]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchStatus(), fetchSummary(), fetchHistory()]);
    setLoading(false);
  }, [fetchStatus, fetchSummary, fetchHistory]);

  // Clock in
  const clockIn = useCallback(async (
    jobId?: string,
    latitude?: number,
    longitude?: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await apiPost(`${API_BASE}/clock-in`, {
        job_id: jobId || null,
        latitude,
        longitude,
        notes,
      }, { headers: getCustomHeaders() as Record<string, string> });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to clock in');
      }

      await refresh();
      return true;
    } catch (err) {
      console.error('Error clocking in:', err);
      setError(err instanceof Error ? err.message : 'Failed to clock in');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCustomHeaders, refresh]);

  // Clock out
  const clockOut = useCallback(async (
    latitude?: number,
    longitude?: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await apiPost(`${API_BASE}/clock-out`, {
        entry_id: status?.entry?.id,
        latitude,
        longitude,
        notes,
      }, { headers: getCustomHeaders() as Record<string, string> });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to clock out');
      }

      await refresh();
      return true;
    } catch (err) {
      console.error('Error clocking out:', err);
      setError(err instanceof Error ? err.message : 'Failed to clock out');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCustomHeaders, status?.entry?.id, refresh]);

  // Start break
  const startBreak = useCallback(async (
    breakType: 'lunch' | 'rest' | 'other' = 'lunch'
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await apiPost(`${API_BASE}/break/start`, {
        entry_id: status?.entry?.id,
        break_type: breakType,
      }, { headers: getCustomHeaders() as Record<string, string> });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start break');
      }

      await fetchStatus();
      return true;
    } catch (err) {
      console.error('Error starting break:', err);
      setError(err instanceof Error ? err.message : 'Failed to start break');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCustomHeaders, status?.entry?.id, fetchStatus]);

  // End break
  const endBreak = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await apiPost(`${API_BASE}/break/end`, {
        break_id: status?.active_break?.id,
      }, { headers: getCustomHeaders() as Record<string, string> });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to end break');
      }

      await fetchStatus();
      return true;
    } catch (err) {
      console.error('Error ending break:', err);
      setError(err instanceof Error ? err.message : 'Failed to end break');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCustomHeaders, status?.active_break?.id, fetchStatus]);

  // Update location
  const updateLocation = useCallback(async (
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean> => {
    try {
      const response = await apiPost(`${API_BASE}/location`, {
        entry_id: status?.entry?.id,
        latitude,
        longitude,
        accuracy,
      }, { headers: getCustomHeaders() as Record<string, string> });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update location');
      }

      return true;
    } catch (err) {
      console.error('Error updating location:', err);
      return false;
    }
  }, [getCustomHeaders, status?.entry?.id]);

  // Timer for elapsed time display
  useEffect(() => {
    if (status?.clocked_in && status.entry) {
      // Update elapsed time every second
      const updateElapsed = () => {
        const clockInTime = new Date(status.entry!.clock_in_time);
        const now = new Date();
        const totalMinutes = (now.getTime() - clockInTime.getTime()) / 60000;

        // Subtract break time if on break
        let effectiveMinutes = totalMinutes;
        if (status.break_minutes) {
          effectiveMinutes -= status.break_minutes;
        }

        setElapsedTime(formatElapsedTime(effectiveMinutes));
      };

      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else {
      setElapsedTime('00:00:00');
    }
  }, [status?.clocked_in, status?.entry, status?.break_minutes, formatElapsedTime]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      refresh();
    }
  }, [user?.id, refresh]);

  return {
    status,
    summary,
    history,
    loading,
    error,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    updateLocation,
    refresh,
    elapsedTime,
  };
}

export default useTimeClock;
