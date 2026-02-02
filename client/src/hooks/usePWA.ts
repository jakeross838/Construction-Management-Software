/**
 * PWA Hook
 *
 * Provides Progressive Web App functionality including:
 * - Online/offline status detection
 * - Install prompt handling
 * - Offline queue management
 * - Background sync coordination
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  getUnsyncedDailyLogs,
  getUnsyncedPhotos,
  getPendingOperations,
  saveOfflineDailyLog,
  saveOfflinePhoto,
  markDailyLogSynced,
  markPhotoSynced,
  clearSynced,
  generateOfflineId,
  getUnsyncedCount,
  type OfflineDailyLog,
  type OfflinePhoto,
  type PendingOperation,
} from '@/utils/offline-storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  failedCount: number;
}

export interface UsePWAReturn {
  // Online status
  isOnline: boolean;

  // Install prompt
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;

  // Sync status
  syncStatus: SyncStatus;
  syncWhenOnline: () => Promise<void>;
  forceSync: () => Promise<void>;

  // Offline data management
  saveLogOffline: (log: Omit<OfflineDailyLog, 'id' | 'created_at' | 'synced'>) => Promise<string>;
  savePhotoOffline: (photo: Omit<OfflinePhoto, 'id' | 'created_at' | 'synced'>) => Promise<string>;
  getOfflineData: () => Promise<{
    dailyLogs: OfflineDailyLog[];
    photos: OfflinePhoto[];
    operations: PendingOperation[];
  }>;

  // Service worker
  swRegistration: ServiceWorkerRegistration | null;
  swUpdateAvailable: boolean;
  updateServiceWorker: () => void;
}

export function usePWA(): UsePWAReturn {
  // Online status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Install prompt
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Service worker
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0,
  });

  // =====================
  // ONLINE STATUS HANDLING
  // =====================

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      toast.success('Back online', {
        description: 'Syncing pending changes...',
        duration: 3000,
      });
      // Trigger sync when coming back online
      syncWhenOnline();
    }

    function handleOffline() {
      setIsOnline(false);
      toast.warning('You are offline', {
        description: 'Changes will be saved locally and synced when online.',
        duration: 5000,
      });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // =====================
  // INSTALL PROMPT HANDLING
  // =====================

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
      toast.success('App installed successfully!');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;

      if (result.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
        return true;
      } else {
        console.log('[PWA] User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Error prompting install:', error);
      return false;
    }
  }, []);

  // =====================
  // SERVICE WORKER
  // =====================

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service workers not supported');
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service worker registered');
        setSwRegistration(registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setSwUpdateAvailable(true);
                toast.info('App update available', {
                  description: 'Click to refresh and get the latest version.',
                  action: {
                    label: 'Update',
                    onClick: () => updateServiceWorker(),
                  },
                  duration: 10000,
                });
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error);
      });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_SUCCESS') {
        console.log('[PWA] Sync success:', event.data.url);
        updatePendingCount();
        toast.success('Synced successfully', {
          description: `${event.data.method} ${event.data.url}`,
        });
      }

      if (event.data.type === 'PENDING_COUNT') {
        setSyncStatus((prev) => ({
          ...prev,
          pendingCount: event.data.count,
        }));
      }

      if (event.data.type === 'SYNC_COMPLETE') {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: Date.now(),
        }));
      }
    });
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [swRegistration]);

  // =====================
  // SYNC FUNCTIONALITY
  // =====================

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getUnsyncedCount();
      setSyncStatus((prev) => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('[PWA] Error getting pending count:', error);
    }
  }, []);

  // Update pending count periodically
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  const syncWhenOnline = useCallback(async () => {
    if (!isOnline) {
      console.log('[PWA] Cannot sync while offline');
      return;
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      // Sync daily logs
      const unsyncedLogs = await getUnsyncedDailyLogs();
      for (const log of unsyncedLogs) {
        try {
          const response = await fetch('/api/daily-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job_id: log.job_id,
              log_date: log.log_date,
              weather_conditions: log.weather_conditions,
              temperature_high: log.temperature_high,
              temperature_low: log.temperature_low,
              weather_notes: log.weather_notes,
              construction_phase: log.construction_phase,
              work_completed: log.work_completed,
              work_planned: log.work_planned,
              delays_issues: log.delays_issues,
              site_visitors: log.site_visitors,
              safety_notes: log.safety_notes,
              crew: log.crew,
              deliveries: log.deliveries,
              inspections: log.inspections,
            }),
          });

          if (response.ok) {
            await markDailyLogSynced(log.id);
            console.log('[PWA] Synced daily log:', log.id);
          } else {
            console.error('[PWA] Failed to sync daily log:', log.id);
          }
        } catch (error) {
          console.error('[PWA] Error syncing daily log:', log.id, error);
        }
      }

      // Sync photos
      const unsyncedPhotos = await getUnsyncedPhotos();
      for (const photo of unsyncedPhotos) {
        try {
          const formData = new FormData();
          formData.append('file', photo.file, photo.fileName);
          formData.append('job_id', photo.job_id);
          if (photo.caption) formData.append('caption', photo.caption);
          if (photo.location) formData.append('location', photo.location);
          if (photo.category) formData.append('category', photo.category);
          if (photo.taken_at) formData.append('taken_at', photo.taken_at);

          const response = await fetch('/api/photos', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            await markPhotoSynced(photo.id);
            console.log('[PWA] Synced photo:', photo.id);
          } else {
            console.error('[PWA] Failed to sync photo:', photo.id);
          }
        } catch (error) {
          console.error('[PWA] Error syncing photo:', photo.id, error);
        }
      }

      // Sync pending operations
      const operations = await getPendingOperations();
      for (const op of operations) {
        if (op.id) {
          try {
            // Operations are already stored as API requests in the service worker
            // Here we just track completion
            await clearSynced(op.id);
          } catch (error) {
            console.error('[PWA] Error clearing synced operation:', op.id, error);
          }
        }
      }

      await updatePendingCount();

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: Date.now(),
      }));

      if (unsyncedLogs.length > 0 || unsyncedPhotos.length > 0) {
        toast.success('Offline data synced', {
          description: `${unsyncedLogs.length} logs, ${unsyncedPhotos.length} photos synced.`,
        });
      }
    } catch (error) {
      console.error('[PWA] Sync error:', error);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        failedCount: prev.failedCount + 1,
      }));
      toast.error('Sync failed', {
        description: 'Some items could not be synced. Will retry later.',
      });
    }
  }, [isOnline, updatePendingCount]);

  const forceSync = useCallback(async () => {
    if (swRegistration?.active) {
      swRegistration.active.postMessage({ type: 'FORCE_SYNC' });
    }
    await syncWhenOnline();
  }, [swRegistration, syncWhenOnline]);

  // =====================
  // OFFLINE DATA SAVING
  // =====================

  const saveLogOffline = useCallback(
    async (log: Omit<OfflineDailyLog, 'id' | 'created_at' | 'synced'>): Promise<string> => {
      const id = generateOfflineId();
      const offlineLog: OfflineDailyLog = {
        ...log,
        id,
        created_at: Date.now(),
        synced: false,
      };

      await saveOfflineDailyLog(offlineLog);
      await updatePendingCount();

      toast.success('Daily log saved offline', {
        description: 'Will sync when back online.',
      });

      return id;
    },
    [updatePendingCount]
  );

  const savePhotoOffline = useCallback(
    async (photo: Omit<OfflinePhoto, 'id' | 'created_at' | 'synced'>): Promise<string> => {
      const id = generateOfflineId();
      const offlinePhoto: OfflinePhoto = {
        ...photo,
        id,
        created_at: Date.now(),
        synced: false,
      };

      await saveOfflinePhoto(offlinePhoto);
      await updatePendingCount();

      toast.success('Photo saved offline', {
        description: 'Will upload when back online.',
      });

      return id;
    },
    [updatePendingCount]
  );

  const getOfflineData = useCallback(async () => {
    const [dailyLogs, photos, operations] = await Promise.all([
      getUnsyncedDailyLogs(),
      getUnsyncedPhotos(),
      getPendingOperations(),
    ]);

    return { dailyLogs, photos, operations };
  }, []);

  return {
    // Online status
    isOnline,

    // Install prompt
    isInstallable,
    isInstalled,
    promptInstall,

    // Sync status
    syncStatus,
    syncWhenOnline,
    forceSync,

    // Offline data management
    saveLogOffline,
    savePhotoOffline,
    getOfflineData,

    // Service worker
    swRegistration,
    swUpdateAvailable,
    updateServiceWorker,
  };
}

export default usePWA;
