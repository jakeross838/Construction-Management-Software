/**
 * API Client with automatic authentication
 *
 * Wraps fetch to automatically add Authorization header from Supabase session
 */

import { supabase } from '@/integrations/supabase/client';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

// Module-level token storage to avoid race conditions with Supabase SDK initialization
// Also store in sessionStorage to survive HMR reloads
let _accessToken: string | null = null;

// Try to recover token from sessionStorage on module load (handles HMR)
try {
  _accessToken = sessionStorage.getItem('_api_access_token');
} catch {
  // sessionStorage not available
}

/**
 * Set the access token for API calls. Called by AuthContext when session is available.
 */
export function setAccessToken(token: string | null) {
  _accessToken = token;
  try {
    if (token) {
      sessionStorage.setItem('_api_access_token', token);
    } else {
      sessionStorage.removeItem('_api_access_token');
    }
  } catch {
    // sessionStorage not available
  }
}

/**
 * Get authorization headers from stored token or Supabase session
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  // First try the module-level stored token
  if (_accessToken) {
    return { 'Authorization': `Bearer ${_accessToken}` };
  }

  // Check sessionStorage (survives HMR reloads)
  try {
    const sessionToken = sessionStorage.getItem('_api_access_token');
    if (sessionToken) {
      _accessToken = sessionToken;
      return { 'Authorization': `Bearer ${sessionToken}` };
    }
  } catch {
    // sessionStorage not available
  }

  // Check localStorage for Supabase token directly (most reliable)
  try {
    const storageKey = Object.keys(localStorage).find(k => k.includes('supabase') && k.includes('auth-token'));
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.access_token) {
          _accessToken = parsed.access_token;
          // Also store in sessionStorage for faster access
          try {
            sessionStorage.setItem('_api_access_token', parsed.access_token);
          } catch {}
          return { 'Authorization': `Bearer ${parsed.access_token}` };
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read token from localStorage:', e);
  }

  // Last resort: Supabase SDK (might not be initialized yet)
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (token) {
      _accessToken = token;
      return { 'Authorization': `Bearer ${token}` };
    }
  } catch (e) {
    console.warn('Failed to get session from Supabase SDK:', e);
  }

  return {};
}

/**
 * Make an authenticated API request
 * Automatically adds Authorization header from Supabase session
 */
export async function apiFetch(url: string, options: ApiOptions = {}): Promise<Response> {
  const { skipAuth, headers: customHeaders, ...fetchOptions } = options;

  let authHeaders: Record<string, string> = {};
  if (!skipAuth) {
    authHeaders = await getAuthHeaders();
  }

  const headers = {
    ...authHeaders,
    ...customHeaders,
  };

  return fetch(url, {
    ...fetchOptions,
    headers,
  });
}

/**
 * GET request with auth
 */
export async function apiGet(url: string, options: ApiOptions = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'GET' });
}

/**
 * POST request with auth
 */
export async function apiPost(url: string, body?: unknown, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  return apiFetch(url, {
    ...options,
    method: 'POST',
    headers: { ...headers, ...(options.headers as Record<string, string>) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request with auth
 */
export async function apiPatch(url: string, body?: unknown, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  return apiFetch(url, {
    ...options,
    method: 'PATCH',
    headers: { ...headers, ...(options.headers as Record<string, string>) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request with auth
 */
export async function apiPut(url: string, body?: unknown, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  return apiFetch(url, {
    ...options,
    method: 'PUT',
    headers: { ...headers, ...(options.headers as Record<string, string>) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request with auth
 */
export async function apiDelete(url: string, options: ApiOptions = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: 'DELETE' });
}
