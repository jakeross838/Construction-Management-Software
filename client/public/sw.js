// Ross Built Construction Management - Service Worker
// Version 1.0.0

const CACHE_NAME = 'ross-built-v1';
const STATIC_CACHE = 'ross-built-static-v1';
const DYNAMIC_CACHE = 'ross-built-dynamic-v1';
const OFFLINE_QUEUE = 'ross-built-offline-queue';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/placeholder.svg',
  // Add more static assets as needed
];

// API routes that should use network-first strategy
const API_ROUTES = ['/api/'];

// Routes that can work offline with cached data
const CACHEABLE_API_ROUTES = [
  '/api/jobs',
  '/api/vendors',
  '/api/cost-codes',
  '/api/daily-logs',
  '/api/photos',
];

// =====================
// INSTALL EVENT
// =====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// =====================
// ACTIVATE EVENT
// =====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches
              return name.startsWith('ross-built-') &&
                     name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// =====================
// FETCH EVENT
// =====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching, but handle offline queue
  if (request.method !== 'GET') {
    // Handle POST/PATCH/DELETE when offline
    event.respondWith(handleMutationRequest(request));
    return;
  }

  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets - cache first with network fallback
  event.respondWith(cacheFirstWithNetwork(request));
});

// =====================
// FETCH STRATEGIES
// =====================

// Cache first, network fallback (for static assets)
async function cacheFirstWithNetwork(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      fetchAndCache(request);
      return cachedResponse;
    }

    return await fetchAndCache(request);
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return getOfflineFallback(request);
  }
}

// Network first, cache fallback (for API requests)
async function networkFirstWithCache(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    // Cache successful API responses for cacheable routes
    if (response.ok && isCacheableApiRoute(url.pathname)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline error response for API
    return new Response(
      JSON.stringify({
        error: 'You are offline',
        offline: true,
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle mutation requests (POST, PATCH, DELETE) when offline
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Network failed - queue for later sync
    console.log('[SW] Queueing offline mutation:', request.url);

    const clonedRequest = request.clone();
    const body = await clonedRequest.text();

    await queueOfflineRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now(),
    });

    // Return a response indicating offline queue
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        queued: true,
        message: 'Request queued for sync when online'
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// =====================
// HELPER FUNCTIONS
// =====================

async function fetchAndCache(request) {
  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

function isCacheableApiRoute(pathname) {
  return CACHEABLE_API_ROUTES.some(route => pathname.startsWith(route));
}

async function getOfflineFallback(request) {
  // Return cached index.html for navigation requests (SPA)
  if (request.mode === 'navigate') {
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) {
      return cachedIndex;
    }
  }

  // Return offline response
  return new Response(
    '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    }
  );
}

// =====================
// OFFLINE QUEUE
// =====================

async function queueOfflineRequest(requestData) {
  // Use IndexedDB for reliable storage
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('RossBuiltOfflineDB', 1);

    dbRequest.onerror = () => reject(dbRequest.error);

    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
      }
    };

    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      const tx = db.transaction('pendingRequests', 'readwrite');
      const store = tx.objectStore('pendingRequests');

      store.add(requestData);

      tx.oncomplete = () => {
        db.close();
        // Register for background sync
        self.registration.sync.register('sync-offline-requests')
          .catch(() => {
            console.log('[SW] Background sync not supported');
          });
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

// =====================
// BACKGROUND SYNC
// =====================

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event received:', event.tag);

  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncOfflineRequests());
  }
});

async function syncOfflineRequests() {
  console.log('[SW] Starting offline sync...');

  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('RossBuiltOfflineDB', 1);

    dbRequest.onerror = () => reject(dbRequest.error);

    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      const tx = db.transaction('pendingRequests', 'readwrite');
      const store = tx.objectStore('pendingRequests');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = async () => {
        const requests = getAllRequest.result;
        console.log('[SW] Found', requests.length, 'pending requests');

        for (const reqData of requests) {
          try {
            const response = await fetch(reqData.url, {
              method: reqData.method,
              headers: reqData.headers,
              body: reqData.body,
            });

            if (response.ok) {
              // Remove from queue
              const deleteTx = db.transaction('pendingRequests', 'readwrite');
              deleteTx.objectStore('pendingRequests').delete(reqData.id);
              await new Promise(resolve => deleteTx.oncomplete = resolve);

              console.log('[SW] Synced request:', reqData.url);

              // Notify clients of successful sync
              self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({
                    type: 'SYNC_SUCCESS',
                    url: reqData.url,
                    method: reqData.method,
                  });
                });
              });
            }
          } catch (error) {
            console.error('[SW] Failed to sync request:', reqData.url, error);
          }
        }

        db.close();
        resolve();
      };
    };
  });
}

// =====================
// PUSH NOTIFICATIONS (future)
// =====================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ross Built', {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: data.data,
      actions: data.actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    })
  );
});

// =====================
// MESSAGE HANDLING
// =====================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_PENDING_COUNT') {
    getPendingRequestCount().then(count => {
      event.source.postMessage({
        type: 'PENDING_COUNT',
        count: count,
      });
    });
  }

  if (event.data.type === 'FORCE_SYNC') {
    syncOfflineRequests().then(() => {
      event.source.postMessage({
        type: 'SYNC_COMPLETE',
      });
    });
  }
});

async function getPendingRequestCount() {
  return new Promise((resolve) => {
    const dbRequest = indexedDB.open('RossBuiltOfflineDB', 1);

    dbRequest.onerror = () => resolve(0);

    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      try {
        const tx = db.transaction('pendingRequests', 'readonly');
        const store = tx.objectStore('pendingRequests');
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          db.close();
          resolve(countRequest.result);
        };

        countRequest.onerror = () => {
          db.close();
          resolve(0);
        };
      } catch (error) {
        db.close();
        resolve(0);
      }
    };
  });
}
