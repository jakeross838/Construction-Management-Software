import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';

// Types
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_name: string;
  title: string;
  message: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  entity_link?: string;
  is_read: boolean;
  read_at?: string;
  priority: NotificationPriority;
  created_at: string;
  expires_at?: string;
}

export interface NotificationPreferences {
  id?: string;
  user_name: string;
  email_enabled: boolean;
  email_frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  in_app_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  phone_number?: string;
  type_preferences: Record<string, {
    in_app?: boolean;
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  }>;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationLog {
  id: string;
  builder_id?: string;
  user_id?: string;
  user_name?: string;
  notification_type: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  retry_count: number;
  external_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationStats {
  total: number;
  by_channel: Record<NotificationChannel, number>;
  by_status: Record<NotificationStatus, number>;
  success_rate: string | number;
  sms_enabled: boolean;
}

export interface SMSTemplate {
  id: string;
  builder_id?: string;
  notification_type: string;
  template_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SMSStatus {
  enabled: boolean;
  message: string;
}

export interface SendNotificationResult {
  channels: Partial<Record<NotificationChannel, boolean>>;
  success: boolean;
}

// API Functions
async function fetchNotifications(user: string, options?: {
  is_read?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<Notification[]> {
  const params = new URLSearchParams({ user });
  if (options?.is_read !== undefined) params.set('is_read', String(options.is_read));
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await apiGet(`/api/notifications?${params}`);
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

async function fetchUnreadCount(user: string): Promise<number> {
  const response = await apiGet(`/api/notifications/unread-count?user=${encodeURIComponent(user)}`);
  if (!response.ok) throw new Error('Failed to fetch unread count');
  const data = await response.json();
  return data.count;
}

async function fetchPreferences(user: string): Promise<NotificationPreferences> {
  const response = await apiGet(`/api/notifications/preferences?user=${encodeURIComponent(user)}`);
  if (!response.ok) throw new Error('Failed to fetch preferences');
  return response.json();
}

async function updatePreferences(prefs: Partial<NotificationPreferences> & { user_name: string }): Promise<NotificationPreferences> {
  const response = await apiPatch('/api/notifications/preferences', prefs);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update preferences');
  }
  return response.json();
}

async function fetchNotificationLog(user: string, options?: {
  channel?: NotificationChannel;
  status?: NotificationStatus;
  limit?: number;
  offset?: number;
}): Promise<NotificationLog[]> {
  const params = new URLSearchParams({ user });
  if (options?.channel) params.set('channel', options.channel);
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await apiGet(`/api/notifications/log?${params}`);
  if (!response.ok) throw new Error('Failed to fetch notification log');
  return response.json();
}

async function fetchNotificationStats(days = 30): Promise<NotificationStats> {
  const response = await apiGet(`/api/notifications/stats?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch notification stats');
  return response.json();
}

async function fetchSMSStatus(): Promise<SMSStatus> {
  const response = await apiGet('/api/notifications/sms/status');
  if (!response.ok) throw new Error('Failed to fetch SMS status');
  return response.json();
}

async function sendTestSMS(to: string, message?: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const response = await apiPost('/api/notifications/test-sms', { to, message });
  return response.json();
}

async function markAsRead(id: string): Promise<Notification> {
  const response = await apiPatch(`/api/notifications/${id}/read`);
  if (!response.ok) throw new Error('Failed to mark notification as read');
  return response.json();
}

async function markAllAsRead(user: string): Promise<void> {
  const response = await apiPost('/api/notifications/mark-all-read', { user });
  if (!response.ok) throw new Error('Failed to mark all notifications as read');
}

async function deleteNotification(id: string): Promise<void> {
  const response = await apiDelete(`/api/notifications/${id}`);
  if (!response.ok) throw new Error('Failed to delete notification');
}

async function clearAllNotifications(user: string): Promise<void> {
  const response = await apiDelete(`/api/notifications/clear-all/${encodeURIComponent(user)}`);
  if (!response.ok) throw new Error('Failed to clear notifications');
}

async function sendNotification(params: {
  user_name: string;
  notification_type: string;
  title?: string;
  message?: string;
  email?: string;
  entity_type?: string;
  entity_id?: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
}): Promise<SendNotificationResult> {
  const response = await apiPost('/api/notifications/send', params);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to send notification');
  }
  return response.json();
}

async function fetchTemplates(): Promise<SMSTemplate[]> {
  const response = await apiGet('/api/notifications/templates');
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
}

async function updateTemplate(type: string, template_text: string, is_active = true): Promise<SMSTemplate> {
  const response = await apiPut(`/api/notifications/templates/${type}`, { template_text, is_active });
  if (!response.ok) throw new Error('Failed to update template');
  return response.json();
}

async function previewTemplate(template: string, data: Record<string, unknown>): Promise<string> {
  const response = await apiPost('/api/notifications/templates/preview', { template, data });
  if (!response.ok) throw new Error('Failed to preview template');
  const result = await response.json();
  return result.rendered;
}

// ========================
// HOOKS
// ========================

/**
 * Get notifications for a user
 */
export function useNotifications(user = '', options?: {
  is_read?: boolean;
  type?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['notifications', user, options],
    queryFn: () => fetchNotifications(user, options),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Get unread notification count
 */
export function useUnreadCount(user = '') {
  return useQuery({
    queryKey: ['notifications-unread-count', user],
    queryFn: () => fetchUnreadCount(user),
    refetchInterval: 30000,
  });
}

/**
 * Get notification preferences
 */
export function useNotificationPreferences(user = '') {
  return useQuery({
    queryKey: ['notification-preferences', user],
    queryFn: () => fetchPreferences(user),
  });
}

/**
 * Update notification preferences
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', data.user_name] });
      toast.success('Notification preferences updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });
}

/**
 * Get notification log/history
 */
export function useNotificationLog(user = '', options?: {
  channel?: NotificationChannel;
  status?: NotificationStatus;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['notification-log', user, options],
    queryFn: () => fetchNotificationLog(user, options),
  });
}

/**
 * Get notification statistics
 */
export function useNotificationStats(days = 30) {
  return useQuery({
    queryKey: ['notification-stats', days],
    queryFn: () => fetchNotificationStats(days),
  });
}

/**
 * Get SMS service status
 */
export function useSMSStatus() {
  return useQuery({
    queryKey: ['sms-status'],
    queryFn: fetchSMSStatus,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Send a test SMS
 */
export function useSendTestSMS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ to, message }: { to: string; message?: string }) => sendTestSMS(to, message),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Test SMS sent successfully');
        queryClient.invalidateQueries({ queryKey: ['notification-log'] });
      } else {
        toast.error(`Failed to send SMS: ${data.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`SMS error: ${error.message}`);
    },
  });
}

/**
 * Mark a notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('All notifications marked as read');
    },
  });
}

/**
 * Delete a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

/**
 * Clear all notifications
 */
export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('All notifications cleared');
    },
  });
}

/**
 * Send a notification via all configured channels
 */
export function useSendNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendNotification,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-log'] });
      if (data.success) {
        const channels = Object.entries(data.channels)
          .filter(([, sent]) => sent)
          .map(([ch]) => ch)
          .join(', ');
        toast.success(`Notification sent via: ${channels || 'in-app'}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send notification: ${error.message}`);
    },
  });
}

/**
 * Get SMS templates
 */
export function useSMSTemplates() {
  return useQuery({
    queryKey: ['sms-templates'],
    queryFn: fetchTemplates,
  });
}

/**
 * Update an SMS template
 */
export function useUpdateSMSTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, template_text, is_active }: { type: string; template_text: string; is_active?: boolean }) =>
      updateTemplate(type, template_text, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      toast.success('SMS template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

/**
 * Preview a template with data
 */
export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ template, data }: { template: string; data: Record<string, unknown> }) =>
      previewTemplate(template, data),
  });
}

// ========================
// NOTIFICATION TYPES
// ========================

export const NOTIFICATION_TYPES = {
  // Invoice/Financial
  invoice_approved: { label: 'Invoice Approved', category: 'Financial' },
  invoice_denied: { label: 'Invoice Denied', category: 'Financial' },
  draw_funded: { label: 'Draw Funded', category: 'Financial' },
  draw_submitted: { label: 'Draw Submitted', category: 'Financial' },
  po_approved: { label: 'PO Approved', category: 'Financial' },
  change_order_approved: { label: 'Change Order Approved', category: 'Financial' },

  // Tasks
  task_assigned: { label: 'Task Assigned', category: 'Tasks' },
  task_due_soon: { label: 'Task Due Soon', category: 'Tasks' },

  // Inspections
  inspection_scheduled: { label: 'Inspection Scheduled', category: 'Inspections' },
  inspection_passed: { label: 'Inspection Passed', category: 'Inspections' },
  inspection_failed: { label: 'Inspection Failed', category: 'Inspections' },

  // RFIs & Submittals
  rfi_received: { label: 'RFI Received', category: 'Documentation' },
  rfi_response: { label: 'RFI Response', category: 'Documentation' },
  submittal_approved: { label: 'Submittal Approved', category: 'Documentation' },
  submittal_rejected: { label: 'Submittal Rejected', category: 'Documentation' },

  // Other
  daily_log_reminder: { label: 'Daily Log Reminder', category: 'Reminders' },
  weather_alert: { label: 'Weather Alert', category: 'Alerts' },
  permit_expiring: { label: 'Permit Expiring', category: 'Permits' },
  mention: { label: 'Mentioned', category: 'Social' },
  message: { label: 'New Message', category: 'Messaging' },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
