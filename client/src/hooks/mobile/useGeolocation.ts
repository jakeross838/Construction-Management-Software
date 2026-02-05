/**
 * Geolocation Hook for Mobile PWA
 * Phase 1.1b: GPS tracking for time clock
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  timestamp: number | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  getCurrentPosition: () => Promise<GeolocationPosition | null>;
  startWatching: () => void;
  stopWatching: () => void;
  isWatching: boolean;
  isSupported: boolean;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 60000,
  watchPosition: false,
};

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const opts = { ...defaultOptions, ...options };
  const watchIdRef = useRef<number | null>(null);

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    timestamp: null,
  });

  const [isWatching, setIsWatching] = useState(false);
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      loading: false,
      timestamp: position.timestamp,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unknown error occurred';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable. Please check your device settings.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.';
        break;
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
    }));
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<GeolocationPosition | null> => {
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      }));
      return null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position);
          resolve(position);
        },
        (error) => {
          handleError(error);
          resolve(null);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        }
      );
    });
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handleSuccess, handleError]);

  const startWatching = useCallback(() => {
    if (!isSupported || watchIdRef.current !== null) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    setIsWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      }
    );
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsWatching(false);
    }
  }, []);

  // Auto-start watching if watchPosition option is true
  useEffect(() => {
    if (opts.watchPosition && isSupported) {
      startWatching();
    }

    return () => {
      stopWatching();
    };
  }, [opts.watchPosition, isSupported, startWatching, stopWatching]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    isWatching,
    isSupported,
  };
}

export default useGeolocation;
