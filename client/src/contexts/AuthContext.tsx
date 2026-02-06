import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { UserRole } from '@/types/auth';
import { apiFetch, apiPost, setAccessToken } from '@/lib/api';

// Database types for our custom tables
interface Builder {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  plan: 'basic' | 'professional' | 'enterprise' | 'trial';
  plan_expires_at: string | null;
  max_active_jobs: number;
  max_users: number;
}

interface DbUser {
  id: string;
  builder_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  builder?: Builder;
}

interface AuthContextType {
  // Supabase auth state
  session: Session | null;
  supabaseUser: SupabaseUser | null;

  // Our app user (from v2_users)
  user: DbUser | null;
  builder: Builder | null;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Auth functions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, builderName: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;

  // Refresh user data
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch user profile from v2_users
  const fetchUserProfile = async (authUserId: string, accessToken?: string) => {
    try {
      // Use provided token or get fresh from Supabase (avoids stale closure)
      const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;

      if (!token) {
        console.warn('No access token available for /api/auth/me');
        return;
      }

      const response = await apiFetch('/api/auth/me', {
        skipAuth: true,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setBuilder(data.builder);
      } else if (response.status === 404) {
        // User authenticated but not in v2_users yet (shouldn't happen normally)
        console.warn('Authenticated user not found in v2_users');
        setUser(null);
        setBuilder(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (initialSession) {
          // Set token in api module BEFORE fetching profile
          setAccessToken(initialSession.access_token);
          setSession(initialSession);
          setSupabaseUser(initialSession.user);
          await fetchUserProfile(initialSession.user.id, initialSession.access_token);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Update token in api module
        setAccessToken(newSession?.access_token || null);
        setSession(newSession);
        setSupabaseUser(newSession?.user || null);

        if (event === 'SIGNED_IN' && newSession) {
          await fetchUserProfile(newSession.user.id, newSession.access_token);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setBuilder(null);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          // Session refreshed, user profile should still be valid
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Re-fetch user profile when session changes
  useEffect(() => {
    if (session?.user && session?.access_token && !user) {
      fetchUserProfile(session.user.id, session.access_token);
    }
  }, [session?.access_token]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Provide user-friendly error messages
        let message = error.message;
        if (error.message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Please confirm your email address before signing in. Check your inbox for a confirmation link.';
        } else if (error.message.includes('rate limit')) {
          message = 'Too many login attempts. Please try again in a few minutes.';
        } else if (error.message.includes('network')) {
          message = 'Network error. Please check your connection and try again.';
        }
        return { error: new Error(message) };
      }

      return { error: null };
    } catch (unexpectedError) {
      console.error('Unexpected error during sign in:', unexpectedError);
      return { error: new Error('An unexpected error occurred. Please try again.') };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    builderName: string,
    firstName?: string,
    lastName?: string
  ) => {
    setIsLoading(true);
    try {
      // First, create the Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            builder_name: builderName,
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (authError) {
        // Provide user-friendly error messages
        let message = authError.message;
        if (authError.message.includes('already registered')) {
          message = 'An account with this email already exists. Please sign in instead.';
        } else if (authError.message.includes('rate limit')) {
          message = 'Too many signup attempts. Please try again in a few minutes.';
        } else if (authError.message.includes('invalid email')) {
          message = 'Please enter a valid email address.';
        } else if (authError.message.includes('password')) {
          message = 'Password does not meet requirements. Please use at least 8 characters with uppercase, lowercase, and a number.';
        }
        return { error: new Error(message) };
      }

      if (!authData.user) {
        return { error: new Error('Failed to create user. Please try again.') };
      }

      // Create the builder and user in our database via API
      let response: Response;
      try {
        response = await apiPost('/api/auth/signup', {
          authUserId: authData.user.id,
          email,
          builderName,
          firstName,
          lastName,
        }, { skipAuth: true });
      } catch (networkError) {
        // Network error - auth user was created but API call failed
        console.error('Network error during signup:', networkError);
        // Don't sign out - the user was created, they just need to try again
        return { error: new Error('Network error. Your account was created - please try signing in.') };
      }

      if (!response.ok) {
        let errorMessage = 'Failed to create builder account';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Response wasn't JSON
          if (response.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (response.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          }
        }
        // Clean up: sign out since we couldn't create the builder
        await supabase.auth.signOut();
        return { error: new Error(errorMessage) };
      }

      return { error: null };
    } catch (unexpectedError) {
      console.error('Unexpected error during signup:', unexpectedError);
      return { error: new Error('An unexpected error occurred. Please try again.') };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Clear token from api module
      setAccessToken(null);
      await supabase.auth.signOut();
      setUser(null);
      setBuilder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const refreshUser = async () => {
    if (session?.user && session?.access_token) {
      await fetchUserProfile(session.user.id, session.access_token);
    }
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error };
  };

  const value: AuthContextType = {
    session,
    supabaseUser,
    user,
    builder,
    isLoading,
    isInitialized,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    resendConfirmation,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to check if user is authenticated
export function useIsAuthenticated(): boolean {
  const { session, isInitialized } = useAuth();
  return isInitialized && !!session;
}

// Hook to require authentication (redirects if not authenticated)
export function useRequireAuth() {
  const { session, isLoading, isInitialized } = useAuth();
  return {
    isAuthenticated: !!session,
    isLoading: isLoading || !isInitialized,
  };
}

// ============================================================
// ROLE-BASED ACCESS CONTROL (RBAC) - mirrors server/middleware/auth.js
// ============================================================

// Permission definitions per role (must match backend)
const rolePermissions: Record<string, Record<string, boolean>> = {
  owner: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true, canManageUsers: true,
  },
  admin: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true, canManageUsers: true,
  },
  accounting: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: true, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false, canManageUsers: false,
  },
  pm: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: true, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false, canManageUsers: false,
  },
  supervisor: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false, canManageUsers: false,
  },
  office: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false, canManageUsers: false,
  },
  field_crew: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false, canManageUsers: false,
  },
};

export type Permission = keyof typeof rolePermissions.owner;

// Hook to check permissions
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || 'field_crew';

  const hasPermission = (permission: Permission): boolean => {
    return rolePermissions[role]?.[permission] ?? false;
  };

  const hasAnyPermission = (...permissions: Permission[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  const hasAllPermissions = (...permissions: Permission[]): boolean => {
    return permissions.every(p => hasPermission(p));
  };

  return {
    role,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwnerOrAdmin: role === 'owner' || role === 'admin',
    canViewFinancials: hasPermission('canViewFinancials'),
    canManageUsers: hasPermission('canManageUsers'),
  };
}

// Component to conditionally render based on permission
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = usePermissions();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
