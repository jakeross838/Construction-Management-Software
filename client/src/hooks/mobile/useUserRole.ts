import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'field_crew' | 'foreman' | 'project_manager' | 'owner' | 'admin';

interface UserRoles {
  role: UserRole | null;
  isFieldCrew: boolean;
  isForeman: boolean;
  isPM: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

export function useUserRole(): UserRoles {
  const { user } = useAuth();

  const roles = useMemo(() => {
    // Get role from user metadata or profile
    const userRole = (user?.user_metadata?.role || user?.role || null) as UserRole | null;

    return {
      role: userRole,
      isFieldCrew: userRole === 'field_crew',
      isForeman: userRole === 'foreman',
      isPM: userRole === 'project_manager',
      isOwner: userRole === 'owner',
      isAdmin: userRole === 'admin',
    };
  }, [user]);

  return roles;
}

export default useUserRole;
