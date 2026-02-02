import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface ApiKey {
  id: string;
  builder_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  last_used_at?: string;
  request_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  revoked_at?: string;
  created_by?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface ApiKeyUsage {
  total_requests: number;
  success_requests: number;
  error_requests: number;
  by_endpoint: Record<string, number>;
  by_day: Record<string, number>;
}

// API Functions
async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await fetch('/api/api-keys');
  if (!response.ok) throw new Error('Failed to fetch API keys');
  const data = await response.json();
  return data.keys;
}

async function createApiKey(params: {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
}): Promise<{ key: ApiKey; api_key: string }> {
  const response = await fetch('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create API key');
  }
  return response.json();
}

async function updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey> {
  const response = await fetch(`/api/api-keys/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update API key');
  const data = await response.json();
  return data.key;
}

async function revokeApiKey(id: string): Promise<void> {
  const response = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to revoke API key');
}

async function fetchApiKeyUsage(id: string, days = 7): Promise<ApiKeyUsage> {
  const response = await fetch(`/api/api-keys/${id}/usage?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch API key usage');
  const data = await response.json();
  return data.usage;
}

// Hooks
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: fetchApiKeys,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ApiKey> }) =>
      updateApiKey(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useApiKeyUsage(id: string, days = 7) {
  return useQuery({
    queryKey: ['api-key-usage', id, days],
    queryFn: () => fetchApiKeyUsage(id, days),
    enabled: !!id,
  });
}
