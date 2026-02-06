import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

export interface Client {
  id: string;
  builder_id: string;
  job_id: string;
  email: string;
  name: string;
  phone?: string;
  portal_enabled: boolean;
  last_login_at?: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
  job?: { id: string; name: string };
}

export interface ClientPortalSettings {
  show_budget: boolean;
  show_schedule: boolean;
  show_photos: boolean;
  show_documents: boolean;
  show_selections: boolean;
  show_change_orders: boolean;
  welcome_message?: string;
  custom_logo_url?: string;
  primary_color?: string;
  allow_messaging: boolean;
  auto_notify_photos: boolean;
  auto_notify_milestones: boolean;
}

export interface ClientMessage {
  id: string;
  builder_id: string;
  job_id: string;
  client_id: string;
  subject?: string;
  content: string;
  direction: 'client_to_builder' | 'builder_to_client';
  sender_name?: string;
  read_at?: string;
  attachments?: string[];
  created_at: string;
  client?: { id: string; name: string; email: string };
}

interface ClientFilters {
  job_id?: string;
}

// ============================================================
// BUILDER-SIDE HOOKS (managing clients)
// ============================================================

async function fetchClients(filters: ClientFilters = {}): Promise<Client[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);

  const response = await apiGet(`/api/client-portal/clients?${params}`);
  if (!response.ok) throw new Error('Failed to fetch clients');
  const data = await response.json();
  return data.clients;
}

async function fetchClient(id: string): Promise<Client> {
  const response = await apiGet(`/api/client-portal/clients/${id}`);
  if (!response.ok) throw new Error('Failed to fetch client');
  return response.json();
}

async function createClient(client: Partial<Client> & { send_invitation?: boolean }): Promise<Client> {
  const response = await apiPost('/api/client-portal/clients', client);
  if (!response.ok) throw new Error('Failed to create client');
  const data = await response.json();
  return data.client;
}

async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const response = await apiPatch(`/api/client-portal/clients/${id}`, updates);
  if (!response.ok) throw new Error('Failed to update client');
  const data = await response.json();
  return data.client;
}

async function deleteClient(id: string): Promise<void> {
  const response = await apiDelete(`/api/client-portal/clients/${id}`);
  if (!response.ok) throw new Error('Failed to delete client');
}

async function sendClientInvitation(id: string): Promise<void> {
  const response = await apiPost(`/api/client-portal/clients/${id}/invite`);
  if (!response.ok) throw new Error('Failed to send invitation');
}

async function fetchPortalSettings(): Promise<ClientPortalSettings> {
  const response = await apiGet('/api/client-portal/settings');
  if (!response.ok) throw new Error('Failed to fetch portal settings');
  const data = await response.json();
  return data.settings;
}

async function updatePortalSettings(settings: Partial<ClientPortalSettings>): Promise<ClientPortalSettings> {
  const response = await apiPatch('/api/client-portal/settings', settings);
  if (!response.ok) throw new Error('Failed to update portal settings');
  const data = await response.json();
  return data.settings;
}

async function fetchMessages(filters: { job_id?: string; client_id?: string } = {}): Promise<ClientMessage[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.client_id) params.append('client_id', filters.client_id);

  const response = await apiGet(`/api/client-portal/messages?${params}`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  const data = await response.json();
  return data.messages;
}

async function sendMessage(message: { job_id?: string; client_id: string; subject?: string; content: string; attachments?: string[] }): Promise<ClientMessage> {
  const response = await apiPost('/api/client-portal/messages', message);
  if (!response.ok) throw new Error('Failed to send message');
  const data = await response.json();
  return data.message;
}

// Hooks for builder-side
export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => fetchClients(filters),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Client> }) =>
      updateClient(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useSendClientInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendClientInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function usePortalSettings() {
  return useQuery({
    queryKey: ['portal-settings'],
    queryFn: fetchPortalSettings,
  });
}

export function useUpdatePortalSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePortalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-settings'] });
    },
  });
}

export function useClientMessages(filters: { job_id?: string; client_id?: string } = {}) {
  return useQuery({
    queryKey: ['client-messages', filters],
    queryFn: () => fetchMessages(filters),
    enabled: !!(filters.job_id || filters.client_id),
  });
}

export function useSendClientMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-messages'] });
    },
  });
}

// ============================================================
// CLIENT-SIDE HOOKS (for portal users)
// ============================================================

export interface PortalSession {
  client: { id: string; name: string; email: string };
  job: { id: string; name: string; address?: string; status?: string };
  builder: { id: string; name: string; logo_url?: string };
  settings: ClientPortalSettings;
  session_token: string;
}

async function validateMagicLink(token: string): Promise<PortalSession> {
  const response = await apiPost('/api/client-portal/auth/magic-link', { token });
  if (!response.ok) throw new Error('Invalid or expired link');
  return response.json();
}

export function useValidateMagicLink() {
  return useMutation({
    mutationFn: validateMagicLink,
  });
}
