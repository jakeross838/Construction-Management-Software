import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { User, mockUser, hasPermission, Permission, UserRole } from '@/types/auth';
import { useAuth } from './AuthContext';

interface UserContextType {
  user: User;
  userName: string;
  userRole: UserRole;
  hasPermission: (permission: Permission) => boolean;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isLoading, isInitialized } = useAuth();

  // Convert auth user to app User type
  const user: User = useMemo(() => {
    if (authUser) {
      return {
        id: authUser.id,
        name: [authUser.first_name, authUser.last_name].filter(Boolean).join(' ') || authUser.email,
        email: authUser.email,
        avatar: authUser.avatar_url || undefined,
        role: authUser.role as UserRole,
      };
    }
    // Fall back to mock user when not authenticated (for backwards compatibility during transition)
    return mockUser;
  }, [authUser]);

  const value: UserContextType = useMemo(() => ({
    user,
    userName: user.name,
    userRole: user.role,
    hasPermission: (permission: Permission) => hasPermission(user.role, permission),
    isLoading: isLoading || !isInitialized,
  }), [user, isLoading, isInitialized]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Return default user if context not available (for backwards compatibility)
    return {
      user: mockUser,
      userName: mockUser.name,
      userRole: mockUser.role,
      hasPermission: (permission: Permission) => hasPermission(mockUser.role, permission),
      isLoading: false,
    };
  }
  return context;
}

// Hook for just the user name (most common use case)
export function useUserName(): string {
  const { userName } = useUser();
  return userName;
}
