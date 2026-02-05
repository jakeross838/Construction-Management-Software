/**
 * Time Clock Component for Mobile PWA
 * Phase 1.1b: Time tracking with GPS
 */

import { useState, useEffect } from 'react';
import { useTimeClock, useGeolocation } from '@/hooks/mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Clock, Coffee, Play, Square, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  name: string;
}

export function TimeClock() {
  const {
    status,
    summary,
    loading,
    error,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    updateLocation,
    refresh,
    elapsedTime,
  } = useTimeClock();

  const {
    latitude,
    longitude,
    accuracy,
    error: geoError,
    loading: geoLoading,
    getCurrentPosition,
    startWatching,
    stopWatching,
    isWatching,
    isSupported: geoSupported,
  } = useGeolocation();

  const [selectedJob, setSelectedJob] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch jobs for dropdown
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v2_jobs')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as Job[];
    },
  });

  // Location tracking while clocked in
  useEffect(() => {
    if (status?.clocked_in && !status.active_break) {
      startWatching();
    } else {
      stopWatching();
    }
  }, [status?.clocked_in, status?.active_break, startWatching, stopWatching]);

  // Update location periodically while clocked in
  useEffect(() => {
    if (status?.clocked_in && latitude && longitude && !status.active_break) {
      const interval = setInterval(() => {
        updateLocation(latitude, longitude, accuracy || undefined);
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [status?.clocked_in, status?.active_break, latitude, longitude, accuracy, updateLocation]);

  const handleClockIn = async () => {
    setIsProcessing(true);
    try {
      // Get current location first
      const position = await getCurrentPosition();
      const lat = position?.coords.latitude;
      const lng = position?.coords.longitude;

      await clockIn(selectedJob || undefined, lat || undefined, lng || undefined, notes || undefined);
      setNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    setIsProcessing(true);
    try {
      // Get current location
      const position = await getCurrentPosition();
      const lat = position?.coords.latitude;
      const lng = position?.coords.longitude;

      await clockOut(lat || undefined, lng || undefined, notes || undefined);
      setNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartBreak = async (type: 'lunch' | 'rest' | 'other' = 'lunch') => {
    setIsProcessing(true);
    try {
      await startBreak(type);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndBreak = async () => {
    setIsProcessing(true);
    try {
      await endBreak();
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isClockedIn = status?.clocked_in;
  const isOnBreak = !!status?.active_break;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className={cn(
        'border-2 transition-colors',
        isClockedIn && !isOnBreak && 'border-green-500 bg-green-500/5',
        isOnBreak && 'border-yellow-500 bg-yellow-500/5',
        !isClockedIn && 'border-muted'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Clock
            </span>
            <Badge variant={isClockedIn ? (isOnBreak ? 'secondary' : 'default') : 'outline'}>
              {isClockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out'}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Elapsed Time Display */}
          {isClockedIn && (
            <div className="text-center py-4">
              <div className="text-4xl font-mono font-bold tabular-nums">
                {elapsedTime}
              </div>
              {status?.entry?.job?.name && (
                <p className="text-sm text-muted-foreground mt-1">
                  {status.entry.job.name}
                </p>
              )}
            </div>
          )}

          {/* Location Status */}
          {isClockedIn && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className={cn(
                'h-4 w-4',
                isWatching && latitude ? 'text-green-500' : 'text-muted-foreground'
              )} />
              <span className="text-muted-foreground">
                {geoLoading ? 'Getting location...' :
                 latitude ? `${latitude.toFixed(6)}, ${longitude?.toFixed(6)}` :
                 geoError || 'Location unavailable'}
              </span>
              {accuracy && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(accuracy)}m)
                </span>
              )}
            </div>
          )}

          {/* Clock In Form */}
          {!isClockedIn && (
            <div className="space-y-3">
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No job selected</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={2}
              />

              <Button
                onClick={handleClockIn}
                disabled={isProcessing || geoLoading}
                className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                ) : (
                  <Play className="h-6 w-6 mr-2" />
                )}
                Clock In
              </Button>
            </div>
          )}

          {/* Clocked In Actions */}
          {isClockedIn && !isOnBreak && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleStartBreak('lunch')}
                disabled={isProcessing}
                variant="outline"
                className="h-12"
              >
                <Coffee className="h-4 w-4 mr-2" />
                Break
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={isProcessing}
                variant="destructive"
                className="h-12"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Clock Out
              </Button>
            </div>
          )}

          {/* On Break Actions */}
          {isOnBreak && (
            <Button
              onClick={handleEndBreak}
              disabled={isProcessing}
              className="w-full h-12 bg-yellow-600 hover:bg-yellow-700"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              End Break
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {(error || geoError) && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error || geoError}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{summary.today.hours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Hours Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{summary.week.hours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Hours This Week</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GPS Not Supported Warning */}
      {!geoSupported && (
        <Card className="border-yellow-500 bg-yellow-500/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              GPS is not supported on this device. Location tracking will be unavailable.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TimeClock;
