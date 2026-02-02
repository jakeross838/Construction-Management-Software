import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface WebhookEvent {
  id: string;
  name: string;
  description?: string;
  category?: string;
  payload_example?: Record<string, unknown>;
  is_active: boolean;
}

export interface Webhook {
  id: string;
  builder_id: string;
  name: string;
  url: string;
  secret: string;  // Masked
  events: string[];
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  last_triggered_at?: string;
  failure_count: number;
  created_at: string;
  updated_at?: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_id: string;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  response_time_ms?: number;
  attempt_number: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  error_message?: string;
  delivered_at?: string;
  created_at: string;
}

export interface TestResult {
  success: boolean;
  status_code?: number;
  error?: string;
  response_time_ms: number;
  response_body?: string;
}

// API Functions
async function fetchWebhookEvents(): Promise<WebhookEvent[]> {
  const response = await fetch('/api/webhooks/events');
  if (!response.ok) throw new Error('Failed to fetch webhook events');
  const data = await response.json();
  return data.events;
}

async function fetchWebhooks(): Promise<Webhook[]> {
  const response = await fetch('/api/webhooks');
  if (!response.ok) throw new Error('Failed to fetch webhooks');
  const data = await response.json();
  return data.webhooks;
}

async function fetchWebhook(id: string): Promise<Webhook> {
  const response = await fetch(`/api/webhooks/${id}`);
  if (!response.ok) throw new Error('Failed to fetch webhook');
  const data = await response.json();
  return data.webhook;
}

async function createWebhook(params: {
  name: string;
  url: string;
  events: string[];
}): Promise<{ webhook: Webhook }> {
  const response = await fetch('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create webhook');
  }
  return response.json();
}

async function updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
  const response = await fetch(`/api/webhooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update webhook');
  const data = await response.json();
  return data.webhook;
}

async function deleteWebhook(id: string): Promise<void> {
  const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete webhook');
}

async function rotateWebhookSecret(id: string): Promise<Webhook> {
  const response = await fetch(`/api/webhooks/${id}/rotate-secret`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to rotate webhook secret');
  const data = await response.json();
  return data.webhook;
}

async function testWebhook(id: string): Promise<TestResult> {
  const response = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to test webhook');
  return response.json();
}

async function fetchWebhookDeliveries(id: string, limit = 50): Promise<WebhookDelivery[]> {
  const response = await fetch(`/api/webhooks/${id}/deliveries?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch deliveries');
  const data = await response.json();
  return data.deliveries;
}

async function retryDelivery(deliveryId: string): Promise<TestResult> {
  const response = await fetch(`/api/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to retry delivery');
  return response.json();
}

// Hooks
export function useWebhookEvents() {
  return useQuery({
    queryKey: ['webhook-events'],
    queryFn: fetchWebhookEvents,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: fetchWebhooks,
  });
}

export function useWebhook(id: string) {
  return useQuery({
    queryKey: ['webhook', id],
    queryFn: () => fetchWebhook(id),
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Webhook> }) =>
      updateWebhook(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['webhook', id] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useRotateWebhookSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rotateWebhookSecret,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['webhook', id] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: testWebhook,
  });
}

export function useWebhookDeliveries(id: string, limit = 50) {
  return useQuery({
    queryKey: ['webhook-deliveries', id, limit],
    queryFn: () => fetchWebhookDeliveries(id, limit),
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useRetryDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
    },
  });
}
