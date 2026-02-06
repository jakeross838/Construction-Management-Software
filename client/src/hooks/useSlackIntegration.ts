import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

// Types
export interface NotificationTypes {
  invoice_received: boolean;
  invoice_approved: boolean;
  invoice_denied: boolean;
  draw_created: boolean;
  draw_submitted: boolean;
  draw_funded: boolean;
  po_created: boolean;
  po_approved: boolean;
  task_assigned: boolean;
  task_completed: boolean;
  daily_summary: boolean;
}

export interface SlackIntegration {
  id: string;
  builder_id: string;
  workspace_name?: string;
  channel_name?: string;
  webhook_url: string; // Will be masked as '***configured***'
  notification_types: NotificationTypes;
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface SlackMessage {
  id: string;
  integration_id: string;
  event_type: string;
  event_id?: string;
  message_text?: string;
  status: 'pending' | 'success' | 'failed';
  response_status?: number;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface NotificationType {
  key: string;
  name: string;
  description: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  status_code?: number;
  error?: string;
}

// API Functions
async function fetchSlackIntegrations(): Promise<SlackIntegration[]> {
  const response = await apiGet('/api/integrations/slack');
  if (!response.ok) throw new Error('Failed to fetch Slack integrations');
  const data = await response.json();
  return data.integrations;
}

async function fetchSlackIntegration(id: string): Promise<SlackIntegration> {
  const response = await apiGet(`/api/integrations/slack/${id}`);
  if (!response.ok) throw new Error('Failed to fetch Slack integration');
  const data = await response.json();
  return data.integration;
}

async function createSlackIntegration(params: {
  webhook_url: string;
  workspace_name?: string;
  channel_name?: string;
  notification_types?: Partial<NotificationTypes>;
}): Promise<{ integration: SlackIntegration }> {
  const response = await apiPost('/api/integrations/slack', params);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create Slack integration');
  }
  return response.json();
}

async function updateSlackIntegration(
  id: string,
  updates: Partial<{
    webhook_url: string;
    workspace_name: string;
    channel_name: string;
    notification_types: Partial<NotificationTypes>;
    enabled: boolean;
  }>
): Promise<SlackIntegration> {
  const response = await apiPatch(`/api/integrations/slack/${id}`, updates);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update Slack integration');
  }
  const data = await response.json();
  return data.integration;
}

async function deleteSlackIntegration(id: string): Promise<void> {
  const response = await apiDelete(`/api/integrations/slack/${id}`);
  if (!response.ok) throw new Error('Failed to delete Slack integration');
}

async function testSlackIntegration(id: string): Promise<TestResult> {
  const response = await apiPost(`/api/integrations/slack/${id}/test`);
  if (!response.ok) throw new Error('Failed to test Slack integration');
  return response.json();
}

async function testSlackWebhookUrl(webhook_url: string): Promise<TestResult> {
  const response = await apiPost('/api/integrations/slack/test-url', { webhook_url });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to test webhook URL');
  }
  return response.json();
}

async function fetchSlackMessages(id: string, limit = 50): Promise<SlackMessage[]> {
  const response = await apiGet(`/api/integrations/slack/${id}/messages?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch Slack messages');
  const data = await response.json();
  return data.messages;
}

async function fetchNotificationTypes(): Promise<NotificationType[]> {
  const response = await apiGet('/api/integrations/slack/notification-types');
  if (!response.ok) throw new Error('Failed to fetch notification types');
  const data = await response.json();
  return data.notification_types;
}

// Hooks

/**
 * Fetch all Slack integrations for the current builder
 */
export function useSlackIntegrations() {
  return useQuery({
    queryKey: ['slack-integrations'],
    queryFn: fetchSlackIntegrations,
  });
}

/**
 * Fetch a specific Slack integration
 */
export function useSlackIntegration(id: string) {
  return useQuery({
    queryKey: ['slack-integration', id],
    queryFn: () => fetchSlackIntegration(id),
    enabled: !!id,
  });
}

/**
 * Create a new Slack integration
 */
export function useCreateSlackIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSlackIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-integrations'] });
    },
  });
}

/**
 * Update a Slack integration
 */
export function useUpdateSlackIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSlackIntegration>[1] }) =>
      updateSlackIntegration(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['slack-integrations'] });
      queryClient.invalidateQueries({ queryKey: ['slack-integration', id] });
    },
  });
}

/**
 * Delete a Slack integration
 */
export function useDeleteSlackIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSlackIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-integrations'] });
    },
  });
}

/**
 * Test a Slack integration by sending a test message
 */
export function useTestSlackIntegration() {
  return useMutation({
    mutationFn: testSlackIntegration,
  });
}

/**
 * Test a webhook URL before saving
 */
export function useTestSlackWebhookUrl() {
  return useMutation({
    mutationFn: testSlackWebhookUrl,
  });
}

/**
 * Fetch message log for a Slack integration
 */
export function useSlackMessages(id: string, limit = 50) {
  return useQuery({
    queryKey: ['slack-messages', id, limit],
    queryFn: () => fetchSlackMessages(id, limit),
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Fetch available notification types
 */
export function useNotificationTypes() {
  return useQuery({
    queryKey: ['slack-notification-types'],
    queryFn: fetchNotificationTypes,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (static data)
  });
}

/**
 * Toggle a specific notification type for an integration
 */
export function useToggleNotificationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      integrationId,
      notificationType,
      enabled,
      currentTypes,
    }: {
      integrationId: string;
      notificationType: keyof NotificationTypes;
      enabled: boolean;
      currentTypes: NotificationTypes;
    }) => {
      const updates = {
        notification_types: {
          ...currentTypes,
          [notificationType]: enabled,
        },
      };
      return updateSlackIntegration(integrationId, updates);
    },
    onSuccess: (_, { integrationId }) => {
      queryClient.invalidateQueries({ queryKey: ['slack-integrations'] });
      queryClient.invalidateQueries({ queryKey: ['slack-integration', integrationId] });
    },
  });
}

/**
 * Enable/disable a Slack integration
 */
export function useToggleSlackIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateSlackIntegration(id, { enabled }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['slack-integrations'] });
      queryClient.invalidateQueries({ queryKey: ['slack-integration', id] });
    },
  });
}
