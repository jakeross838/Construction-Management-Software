import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export type EmailTemplateType =
  | 'invoice_notification'
  | 'draw_submitted'
  | 'task_assigned'
  | 'po_approved'
  | 'bid_request'
  | 'custom';

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'delivered' | 'opened';

export interface EmailTemplate {
  id: string;
  builder_id?: string;
  name: string;
  subject_template: string;
  body_template: string;
  template_type: EmailTemplateType;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SentEmail {
  id: string;
  builder_id?: string;
  template_id?: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  body: string;
  body_html?: string;
  attachments: EmailAttachment[];
  status: EmailStatus;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  error_message?: string;
  provider_message_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  created_by: string;
  created_at: string;
  template?: {
    id: string;
    name: string;
    template_type: EmailTemplateType;
  };
}

export interface EmailAttachment {
  name: string;
  url?: string;
  content?: string;  // Base64 encoded
  size?: number;
  type?: string;
}

export interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  pending: number;
  opened: number;
  deliveryRate: number | string;
  providerConfigured: boolean;
  provider: string;
}

export interface EmailSettings {
  provider: 'none' | 'sendgrid' | 'smtp' | 'ses';
  from_name?: string;
  from_email?: string;
  reply_to_email?: string;
  signature_html?: string;
  footer_html?: string;
}

export interface EmailTemplateTypeInfo {
  type: EmailTemplateType;
  name: string;
  description: string;
  defaultVariables: string[];
}

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  body_html?: string;
  attachments?: EmailAttachment[];
  template_id?: string;
  template_type?: EmailTemplateType;
  variables?: Record<string, string>;
  related_entity_type?: string;
  related_entity_id?: string;
  created_by?: string;
  builder_id?: string;
}

export interface BulkEmailParams {
  recipients: Array<{ email: string; variables?: Record<string, string> }>;
  template_id?: string;
  template_type?: EmailTemplateType;
  base_variables?: Record<string, string>;
  related_entity_type?: string;
  related_entity_id?: string;
  created_by?: string;
  builder_id?: string;
}

export interface TemplateFilters {
  type?: EmailTemplateType;
  is_default?: boolean;
  builder_id?: string;
}

export interface SentEmailFilters {
  status?: EmailStatus;
  related_entity_type?: string;
  related_entity_id?: string;
  created_by?: string;
  builder_id?: string;
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
}

// ============================================================
// API FUNCTIONS
// ============================================================

// Templates
async function fetchTemplates(filters: TemplateFilters = {}): Promise<EmailTemplate[]> {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.is_default !== undefined) params.append('is_default', String(filters.is_default));
  if (filters.builder_id) params.append('builder_id', filters.builder_id);

  const response = await apiGet(`/api/emails/templates?${params}`);
  if (!response.ok) throw new Error('Failed to fetch email templates');
  return response.json();
}

async function fetchTemplate(id: string): Promise<EmailTemplate> {
  const response = await apiGet(`/api/emails/templates/${id}`);
  if (!response.ok) throw new Error('Failed to fetch email template');
  return response.json();
}

async function createTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await apiPost('/api/emails/templates', template);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  return response.json();
}

async function updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await apiPatch(`/api/emails/templates/${id}`, updates);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  return response.json();
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await apiDelete(`/api/emails/templates/${id}`);
  if (!response.ok) throw new Error('Failed to delete template');
}

async function previewTemplate(id: string, variables: Record<string, string>): Promise<{ subject: string; body: string }> {
  const response = await apiPost(`/api/emails/templates/${id}/preview`, { variables });
  if (!response.ok) throw new Error('Failed to preview template');
  return response.json();
}

// Sending
async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; emailId: string; provider: string }> {
  const response = await apiPost('/api/emails/send', params);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send email');
  }
  return response.json();
}

async function sendBulkEmail(params: BulkEmailParams): Promise<{ total: number; sent: number; failed: number }> {
  const response = await apiPost('/api/emails/send-bulk', params);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send bulk email');
  }
  return response.json();
}

// Sent emails
async function fetchSentEmails(filters: SentEmailFilters = {}): Promise<SentEmail[]> {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.related_entity_type) params.append('related_entity_type', filters.related_entity_type);
  if (filters.related_entity_id) params.append('related_entity_id', filters.related_entity_id);
  if (filters.created_by) params.append('created_by', filters.created_by);
  if (filters.builder_id) params.append('builder_id', filters.builder_id);
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);

  const response = await apiGet(`/api/emails/sent?${params}`);
  if (!response.ok) throw new Error('Failed to fetch sent emails');
  return response.json();
}

async function fetchSentEmail(id: string): Promise<SentEmail> {
  const response = await apiGet(`/api/emails/sent/${id}`);
  if (!response.ok) throw new Error('Failed to fetch sent email');
  return response.json();
}

async function resendEmail(id: string): Promise<{ success: boolean; emailId: string }> {
  const response = await apiPost(`/api/emails/sent/${id}/resend`);
  if (!response.ok) throw new Error('Failed to resend email');
  return response.json();
}

// Stats & Settings
async function fetchEmailStats(builderId?: string, days?: number): Promise<EmailStats> {
  const params = new URLSearchParams();
  if (builderId) params.append('builder_id', builderId);
  if (days) params.append('days', String(days));

  const response = await apiGet(`/api/emails/stats?${params}`);
  if (!response.ok) throw new Error('Failed to fetch email stats');
  return response.json();
}

async function fetchEmailSettings(builderId?: string): Promise<EmailSettings> {
  const params = builderId ? `?builder_id=${builderId}` : '';
  const response = await apiGet(`/api/emails/settings${params}`);
  if (!response.ok) throw new Error('Failed to fetch email settings');
  return response.json();
}

async function updateEmailSettings(settings: EmailSettings & { builder_id?: string }): Promise<EmailSettings> {
  const response = await apiPut('/api/emails/settings', settings);
  if (!response.ok) throw new Error('Failed to update email settings');
  return response.json();
}

async function fetchTemplateTypes(): Promise<EmailTemplateTypeInfo[]> {
  const response = await apiGet('/api/emails/template-types');
  if (!response.ok) throw new Error('Failed to fetch template types');
  return response.json();
}

// ============================================================
// HOOKS - Templates
// ============================================================

export function useEmailTemplates(filters: TemplateFilters = {}) {
  return useQuery({
    queryKey: ['email-templates', filters],
    queryFn: () => fetchTemplates(filters),
  });
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: ['email-template', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id,
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Email template created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<EmailTemplate> }) =>
      updateTemplate(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-template', id] });
      toast.success('Email template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Email template deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

export function usePreviewEmailTemplate() {
  return useMutation({
    mutationFn: ({ id, variables }: { id: string; variables: Record<string, string> }) =>
      previewTemplate(id, variables),
    onError: (error: Error) => {
      toast.error(`Failed to preview template: ${error.message}`);
    },
  });
}

// ============================================================
// HOOKS - Sending
// ============================================================

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      toast.success('Email sent successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });
}

export function useSendBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendBulkEmail,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      if (result.failed > 0) {
        toast.warning(`Sent ${result.sent} of ${result.total} emails. ${result.failed} failed.`);
      } else {
        toast.success(`Successfully sent ${result.sent} emails`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send bulk email: ${error.message}`);
    },
  });
}

export function useResendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent-emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      toast.success('Email resent successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resend email: ${error.message}`);
    },
  });
}

// ============================================================
// HOOKS - Sent Emails
// ============================================================

export function useSentEmails(filters: SentEmailFilters = {}) {
  return useQuery({
    queryKey: ['sent-emails', filters],
    queryFn: () => fetchSentEmails(filters),
  });
}

export function useSentEmail(id: string) {
  return useQuery({
    queryKey: ['sent-email', id],
    queryFn: () => fetchSentEmail(id),
    enabled: !!id,
  });
}

// ============================================================
// HOOKS - Stats & Settings
// ============================================================

export function useEmailStats(builderId?: string, days = 30) {
  return useQuery({
    queryKey: ['email-stats', builderId, days],
    queryFn: () => fetchEmailStats(builderId, days),
  });
}

export function useEmailSettings(builderId?: string) {
  return useQuery({
    queryKey: ['email-settings', builderId],
    queryFn: () => fetchEmailSettings(builderId),
  });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEmailSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      toast.success('Email settings updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
}

export function useEmailTemplateTypes() {
  return useQuery({
    queryKey: ['email-template-types'],
    queryFn: fetchTemplateTypes,
    staleTime: Infinity,  // Template types don't change
  });
}

// ============================================================
// HELPER CONSTANTS
// ============================================================

export const emailStatusConfig: Record<EmailStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-gray-500', bgColor: 'bg-gray-500' },
  sent: { label: 'Sent', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  delivered: { label: 'Delivered', color: 'text-green-500', bgColor: 'bg-green-500' },
  failed: { label: 'Failed', color: 'text-red-500', bgColor: 'bg-red-500' },
  bounced: { label: 'Bounced', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  opened: { label: 'Opened', color: 'text-purple-500', bgColor: 'bg-purple-500' },
};

export const templateTypeConfig: Record<EmailTemplateType, { label: string; icon: string }> = {
  invoice_notification: { label: 'Invoice Notification', icon: 'FileText' },
  draw_submitted: { label: 'Draw Submitted', icon: 'Landmark' },
  task_assigned: { label: 'Task Assigned', icon: 'CheckSquare' },
  po_approved: { label: 'PO Approved', icon: 'Package' },
  bid_request: { label: 'Bid Request', icon: 'Gavel' },
  custom: { label: 'Custom', icon: 'Mail' },
};
