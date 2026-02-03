import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE = '/api/lead-notifications';

export interface NotificationPreferences {
  id?: string;
  user_id: string;
  notify_new_lead: boolean;
  notify_stage_change: boolean;
  notify_lead_won: boolean;
  notify_lead_lost: boolean;
  notify_follow_up_due: boolean;
  follow_up_reminder_hours: number;
  notify_stale_leads: boolean;
  stale_lead_days: number;
  email_notifications: boolean;
  in_app_notifications: boolean;
}

export interface LeadNotification {
  id: string;
  lead_id: string | null;
  user_id: string;
  notification_type: 'new_lead' | 'stage_change' | 'follow_up_due' | 'stale_lead' | 'won' | 'lost';
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    stage: string;
  };
}

export interface LeadReminder {
  id: string;
  lead_id: string;
  user_id: string;
  reminder_type: 'follow_up' | 'custom' | 'stale_check';
  reminder_at: string;
  message: string | null;
  is_sent: boolean;
  sent_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    stage: string;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  template_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch notification preferences
export function useNotificationPreferences(userId: string = 'default-user') {
  return useQuery({
    queryKey: ['lead-notification-preferences', userId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/preferences?user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch preferences');
      return res.json() as Promise<NotificationPreferences>;
    },
  });
}

// Update notification preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const res = await fetch(`${API_BASE}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-notification-preferences', variables.user_id || 'default-user'] });
      toast.success('Notification preferences updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });
}

// Fetch notifications
export function useLeadNotifications(options: { userId?: string; unreadOnly?: boolean; limit?: number } = {}) {
  const { userId = 'default-user', unreadOnly = false, limit = 50 } = options;

  return useQuery({
    queryKey: ['lead-notifications', userId, unreadOnly, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: userId,
        unread: String(unreadOnly),
        limit: String(limit),
      });
      const res = await fetch(`${API_BASE}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json() as Promise<LeadNotification[]>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch unread count
export function useUnreadNotificationCount(userId: string = 'default-user') {
  return useQuery({
    queryKey: ['lead-notification-count', userId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/count?user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch count');
      const data = await res.json();
      return data.count as number;
    },
    refetchInterval: 30000,
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`${API_BASE}/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['lead-notification-count'] });
    },
  });
}

// Mark all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string = 'default-user') => {
      const res = await fetch(`${API_BASE}/read-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['lead-notification-count'] });
      toast.success('All notifications marked as read');
    },
  });
}

// Fetch reminders
export function useLeadReminders(options: { userId?: string; leadId?: string } = {}) {
  const { userId = 'default-user', leadId } = options;

  return useQuery({
    queryKey: ['lead-reminders', userId, leadId],
    queryFn: async () => {
      const params = new URLSearchParams({ user_id: userId });
      if (leadId) params.append('lead_id', leadId);
      const res = await fetch(`${API_BASE}/reminders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json() as Promise<LeadReminder[]>;
    },
  });
}

// Create reminder
export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminder: { lead_id: string; reminder_at: string; message?: string; reminder_type?: string }) => {
      const res = await fetch(`${API_BASE}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminder),
      });
      if (!res.ok) throw new Error('Failed to create reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-reminders'] });
      toast.success('Reminder created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create reminder: ${error.message}`);
    },
  });
}

// Dismiss reminder
export function useDismissReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const res = await fetch(`${API_BASE}/reminders/${reminderId}/dismiss`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to dismiss reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-reminders'] });
      toast.success('Reminder dismissed');
    },
  });
}

// Fetch stale leads
export function useStaleleads(days: number = 7) {
  return useQuery({
    queryKey: ['stale-leads', days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/stale-leads?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch stale leads');
      return res.json();
    },
  });
}

// Fetch email templates
export function useEmailTemplates() {
  return useQuery({
    queryKey: ['lead-email-templates'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/templates`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json() as Promise<EmailTemplate[]>;
    },
  });
}

// Update email template
export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...template }: { id: string; subject?: string; body_html?: string; body_text?: string; is_active?: boolean }) => {
      const res = await fetch(`${API_BASE}/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-email-templates'] });
      toast.success('Template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}
