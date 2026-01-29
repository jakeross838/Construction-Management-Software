import React, { createContext, useContext, ReactNode } from 'react';
import { User, mockUser, hasPermission, Permission, UserRole } from '@/types/auth';

interface UserContextType {
  user: User;
  userName: string;
  userRole: UserRole;
  hasPermission: (permission: Permission) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // TODO: Replace mockUser with actual authenticated user from auth system
  const user = mockUser;

  const value: UserContextType = {
    user,
    userName: user.name,
    userRole: user.role,
    hasPermission: (permission: Permission) => hasPermission(user.role, permission),
  };

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
    };
  }
  return context;
}

// Hook for just the user name (most common use case)
export function useUserName(): string {
  const { userName } = useUser();
  return userName;
}
