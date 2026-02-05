import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { LocationIndicator } from './LocationIndicator';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  notificationsCount?: number;
  showHeader?: boolean;
  showNav?: boolean;
  showLocationIndicator?: boolean;
  isTrackingLocation?: boolean;
  className?: string;
}

export function MobileLayout({
  children,
  title,
  notificationsCount = 0,
  showHeader = true,
  showNav = true,
  showLocationIndicator = true,
  isTrackingLocation = false,
  className,
}: MobileLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        'relative flex flex-col min-h-screen',
        'bg-background text-foreground',
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <MobileHeader
          title={title}
          notificationsCount={notificationsCount}
          onMenuClick={() => setMenuOpen(!menuOpen)}
        />
      )}

      {/* Location tracking indicator */}
      {showLocationIndicator && (
        <LocationIndicator isTracking={isTrackingLocation} />
      )}

      {/* Main content area */}
      <main
        className={cn(
          'flex-1 overflow-y-auto',
          showHeader && 'pt-14', // Header height
          showNav && 'pb-16', // Bottom nav height
        )}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      {showNav && <BottomNav />}
    </div>
  );
}

export default MobileLayout;
