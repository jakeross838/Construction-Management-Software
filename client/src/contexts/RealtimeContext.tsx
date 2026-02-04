import { createContext, useContext, ReactNode } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuth } from '@/contexts/AuthContext';

interface RealtimeContextValue {
  isConnected: boolean;
  lastPing: Date | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  lastPing: null,
});

interface RealtimeProviderProps {
  children: ReactNode;
}

/**
 * Provider component that establishes real-time SSE connection
 * Should be placed inside AuthProvider to only connect when authenticated
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { user, isLoading } = useAuth();

  // Only connect when user is authenticated
  const { isConnected, lastPing } = useRealtime({
    enabled: !isLoading && !!user,
    showToasts: true,
  });

  return (
    <RealtimeContext.Provider value={{ isConnected, lastPing }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Hook to access real-time connection status
 */
export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}

export default RealtimeProvider;
