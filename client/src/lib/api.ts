/**
 * API Client with automatic authentication
 *
 * Wraps fetch to automatically add Authorization header from Supabase session
 */

import { supabase } from '@/integrations/supabase/client';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Get authorization headers from current Supabase session
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (token) {
    return { 'Authorization': `Bearer ${token}` };
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
