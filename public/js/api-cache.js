/**
 * API Cache Utility
 * Caches API responses in localStorage with TTL support
 * Reduces redundant API calls across page loads
 */

window.APICache = {
  // Default TTL: 5 minutes
  DEFAULT_TTL: 5 * 60 * 1000,

  // Cache key prefix
  PREFIX: 'api_cache_',

  /**
   * Get cached data if still valid
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/missing
   */
  get(key) {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      if (!item) return null;

      const { data, expires } = JSON.parse(item);
      if (Date.now() > expires) {
        localStorage.removeItem(this.PREFIX + key);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('Cache read error:', err);
      return null;
    }
  },

  /**
   * Set cache data with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in ms (optional)
   */
  set(key, data, ttl = this.DEFAULT_TTL) {
    try {
      const item = {
        data,
        expires: Date.now() + ttl
      };
      localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
    } catch (err) {
      // localStorage might be full or disabled
      console.warn('Cache write error:', err);
    }
  },

  /**
   * Invalidate specific cache key
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  /**
   * Invalidate all API cache
   */
  invalidateAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  },

  /**
   * Fetch with cache - returns cached data if valid, else fetches
   * @param {string} url - API URL
   * @param {object} options - Optional: { ttl, forceRefresh }
   * @returns {Promise<any>} - Response data
   */
  async fetch(url, options = {}) {
    const { ttl = this.DEFAULT_TTL, forceRefresh = false } = options;
    const cacheKey = url;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Fetch from API
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    this.set(cacheKey, data, ttl);
    return data;
  }
};

// Request deduplication - prevents duplicate in-flight requests
window.RequestDedup = {
  pending: new Map(),

  /**
   * Fetch with deduplication - reuses pending requests for same URL
   * @param {string} url - API URL
   * @returns {Promise<Response>}
   */
  async fetch(url) {
    // If request already in flight, return the same promise
    if (this.pending.has(url)) {
      return this.pending.get(url);
    }

    // Create new request
    const promise = fetch(url).then(async (response) => {
      this.pending.delete(url);
      return response;
    }).catch(err => {
      this.pending.delete(url);
      throw err;
    });

    this.pending.set(url, promise);
    return promise;
  }
};
