/**
 * Offline Storage Utility
 *
 * Provides IndexedDB wrapper for storing offline data and pending API operations.
 * Used by the PWA for background sync functionality.
 */

const DB_NAME = 'RossBuiltOfflineDB';
const DB_VERSION = 2;

// Store names
const STORES = {
  PENDING_REQUESTS: 'pendingRequests',
  OFFLINE_DAILY_LOGS: 'offlineDailyLogs',
  OFFLINE_PHOTOS: 'offlinePhotos',
  CACHED_DATA: 'cachedData',
} as const;

export type OperationType = 'create' | 'update' | 'delete';

export interface PendingOperation {
  id?: number;
  entityType: 'daily_log' | 'photo' | 'inspection' | 'punch_item';
  operationType: OperationType;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface OfflineDailyLog {
  id: string; // Local UUID
  job_id: string;
  log_date: string;
  weather_conditions?: string;
  temperature_high?: number;
  temperature_low?: number;
  weather_notes?: string;
  construction_phase?: string;
  work_completed?: string;
  work_planned?: string;
  delays_issues?: string;
  site_visitors?: string;
  safety_notes?: string;
  crew?: Array<{
    vendor_id?: string;
    worker_count: number;
    hours_worked?: number;
    trade?: string;
    notes?: string;
  }>;
  deliveries?: Array<{
    vendor_id?: string;
    description: string;
    quantity?: number;
    notes?: string;
  }>;
  inspections?: Array<{
    inspection_type: string;
    result?: string;
    notes?: string;
  }>;
  created_at: number;
  synced: boolean;
}

export interface OfflinePhoto {
  id: string; // Local UUID
  job_id: string;
  file: Blob;
  fileName: string;
  caption?: string;
  location?: string;
  category?: string;
  taken_at?: string;
  latitude?: number;
  longitude?: number;
  created_at: number;
  synced: boolean;
}

// =====================
// DATABASE INITIALIZATION
// =====================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineStorage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.PENDING_REQUESTS)) {
        db.createObjectStore(STORES.PENDING_REQUESTS, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_DAILY_LOGS)) {
        const logsStore = db.createObjectStore(STORES.OFFLINE_DAILY_LOGS, { keyPath: 'id' });
        logsStore.createIndex('job_id', 'job_id', { unique: false });
        logsStore.createIndex('synced', 'synced', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_PHOTOS)) {
        const photosStore = db.createObjectStore(STORES.OFFLINE_PHOTOS, { keyPath: 'id' });
        photosStore.createIndex('job_id', 'job_id', { unique: false });
        photosStore.createIndex('synced', 'synced', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CACHED_DATA)) {
        db.createObjectStore(STORES.CACHED_DATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// =====================
// PENDING OPERATIONS
// =====================

/**
 * Queue an operation to be synced when online
 */
export async function queuePendingOperation(operation: Omit<PendingOperation, 'id'>): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REQUESTS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REQUESTS);

    const request = store.add(operation);

    request.onsuccess = () => {
      db.close();
      resolve(request.result as number);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REQUESTS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_REQUESTS);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a pending operation after successful sync
 */
export async function clearSynced(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REQUESTS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REQUESTS);
    const request = store.delete(id);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all pending operations
 */
export async function clearAllPending(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REQUESTS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REQUESTS);
    const request = store.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// =====================
// OFFLINE DAILY LOGS
// =====================

/**
 * Save a daily log for offline use
 */
export async function saveOfflineDailyLog(log: OfflineDailyLog): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_DAILY_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_DAILY_LOGS);
    const request = store.put(log);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all offline daily logs
 */
export async function getOfflineDailyLogs(jobId?: string): Promise<OfflineDailyLog[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_DAILY_LOGS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_DAILY_LOGS);

    let request: IDBRequest<OfflineDailyLog[]>;

    if (jobId) {
      const index = store.index('job_id');
      request = index.getAll(jobId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get unsynced daily logs
 */
export async function getUnsyncedDailyLogs(): Promise<OfflineDailyLog[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_DAILY_LOGS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_DAILY_LOGS);
    // Note: We can't use IDBKeyRange.only(false) because booleans are not valid IndexedDB keys
    // Instead, get all records and filter in memory
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      // Filter for unsynced items (synced is false or falsy)
      resolve(request.result.filter((log: OfflineDailyLog) => !log.synced));
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Mark a daily log as synced
 */
export async function markDailyLogSynced(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_DAILY_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_DAILY_LOGS);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const log = getRequest.result;
      if (log) {
        log.synced = true;
        store.put(log);
      }
      db.close();
      resolve();
    };

    getRequest.onerror = () => {
      db.close();
      reject(getRequest.error);
    };
  });
}

/**
 * Delete a daily log from offline storage
 */
export async function deleteOfflineDailyLog(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_DAILY_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_DAILY_LOGS);
    const request = store.delete(id);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// =====================
// OFFLINE PHOTOS
// =====================

/**
 * Save a photo for offline use
 */
export async function saveOfflinePhoto(photo: OfflinePhoto): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_PHOTOS);
    const request = store.put(photo);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all offline photos
 */
export async function getOfflinePhotos(jobId?: string): Promise<OfflinePhoto[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_PHOTOS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_PHOTOS);

    let request: IDBRequest<OfflinePhoto[]>;

    if (jobId) {
      const index = store.index('job_id');
      request = index.getAll(jobId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get unsynced photos
 */
export async function getUnsyncedPhotos(): Promise<OfflinePhoto[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_PHOTOS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_PHOTOS);
    // Note: We can't use IDBKeyRange.only(false) because booleans are not valid IndexedDB keys
    // Instead, get all records and filter in memory
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      // Filter for unsynced items (synced is false or falsy)
      resolve(request.result.filter((photo: OfflinePhoto) => !photo.synced));
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Mark a photo as synced
 */
export async function markPhotoSynced(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_PHOTOS);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const photo = getRequest.result;
      if (photo) {
        photo.synced = true;
        store.put(photo);
      }
      db.close();
      resolve();
    };

    getRequest.onerror = () => {
      db.close();
      reject(getRequest.error);
    };
  });
}

/**
 * Delete a photo from offline storage
 */
export async function deleteOfflinePhoto(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_PHOTOS);
    const request = store.delete(id);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// =====================
// CACHED DATA
// =====================

export interface CachedDataEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

/**
 * Cache data for offline use
 */
export async function cacheData<T>(key: string, data: T, ttlMs?: number): Promise<void> {
  const db = await openDB();

  const entry: CachedDataEntry<T> = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = tx.objectStore(STORES.CACHED_DATA);
    const request = store.put(entry);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get cached data
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHED_DATA, 'readonly');
    const store = tx.objectStore(STORES.CACHED_DATA);
    const request = store.get(key);

    request.onsuccess = () => {
      db.close();
      const entry = request.result as CachedDataEntry<T> | undefined;

      if (!entry) {
        resolve(null);
        return;
      }

      // Check expiration
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        // Expired - delete and return null
        deleteCachedData(key);
        resolve(null);
        return;
      }

      resolve(entry.data);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete cached data
 */
export async function deleteCachedData(key: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = tx.objectStore(STORES.CACHED_DATA);
    const request = store.delete(key);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// =====================
// UTILITY FUNCTIONS
// =====================

/**
 * Generate a UUID for offline entities
 */
export function generateOfflineId(): string {
  return 'offline-' + crypto.randomUUID();
}

/**
 * Check if an ID is an offline-generated ID
 */
export function isOfflineId(id: string): boolean {
  return id.startsWith('offline-');
}

/**
 * Get total count of unsynced items
 */
export async function getUnsyncedCount(): Promise<number> {
  const [logs, photos, operations] = await Promise.all([
    getUnsyncedDailyLogs(),
    getUnsyncedPhotos(),
    getPendingOperations(),
  ]);

  return logs.length + photos.length + operations.length;
}

/**
 * Clear all offline data (use with caution)
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [STORES.PENDING_REQUESTS, STORES.OFFLINE_DAILY_LOGS, STORES.OFFLINE_PHOTOS, STORES.CACHED_DATA],
      'readwrite'
    );

    tx.objectStore(STORES.PENDING_REQUESTS).clear();
    tx.objectStore(STORES.OFFLINE_DAILY_LOGS).clear();
    tx.objectStore(STORES.OFFLINE_PHOTOS).clear();
    tx.objectStore(STORES.CACHED_DATA).clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Export offline data for backup/debugging
 */
export async function exportOfflineData(): Promise<{
  dailyLogs: OfflineDailyLog[];
  photos: OfflinePhoto[];
  pendingOperations: PendingOperation[];
}> {
  const [dailyLogs, photos, pendingOperations] = await Promise.all([
    getOfflineDailyLogs(),
    getOfflinePhotos(),
    getPendingOperations(),
  ]);

  return {
    dailyLogs,
    photos,
    pendingOperations,
  };
}
