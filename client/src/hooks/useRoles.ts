import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: string;
}

export interface TeamMember {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: Role;
  created_at: string;
  last_sign_in_at?: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: Role;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
}

// API Functions
async function fetchRoles(): Promise<Role[]> {
  const response = await fetch('/api/roles');
  if (!response.ok) throw new Error('Failed to fetch roles');
  const data = await response.json();
  return data.roles;
}

async function fetchPermissions(): Promise<{ permissions: Permission[]; grouped: Record<string, Permission[]> }> {
  const response = await fetch('/api/roles/permissions/all');
  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const response = await fetch('/api/roles/team/members');
  if (!response.ok) throw new Error('Failed to fetch team members');
  const data = await response.json();
  return data.members;
}

async function fetchMyPermissions(): Promise<{ permissions: string[]; role: { name: string; display_name: string } | null }> {
  const response = await fetch('/api/roles/me/permissions');
  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

async function updateMemberRole(userId: string, roleId: string): Promise<TeamMember> {
  const response = await fetch(`/api/roles/team/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_id: roleId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update role');
  }
  const data = await response.json();
  return data.user;
}

async function inviteTeamMember(params: {
  email: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
}): Promise<TeamInvitation> {
  const response = await fetch('/api/roles/team/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to invite team member');
  }
  const data = await response.json();
  return data.invitation;
}

async function removeTeamMember(userId: string): Promise<void> {
  const response = await fetch(`/api/roles/team/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove team member');
  }
}

// Hooks
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: ['my-permissions'],
    queryFn: fetchMyPermissions,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      updateMemberRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

// Permission check hook
export function useHasPermission(permission: string | string[]): boolean {
  const { data } = useMyPermissions();
  const permissions = Array.isArray(permission) ? permission : [permission];

  if (!data?.permissions) return false;
  if (data.role?.name === 'owner') return true;

  return permissions.some(p => data.permissions.includes(p));
}

// Role check hook
export function useIsRole(roleName: string | string[]): boolean {
  const { data } = useMyPermissions();
  const roles = Array.isArray(roleName) ? roleName : [roleName];

  if (!data?.role) return false;
  return roles.includes(data.role.name);
}
