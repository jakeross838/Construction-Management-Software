import { Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title?: string;
  notificationsCount?: number;
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  className?: string;
}

export function MobileHeader({
  title = 'Ross Built',
  notificationsCount = 0,
  onMenuClick,
  onNotificationsClick,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b border-border',
        'px-4 h-14 flex items-center justify-between',
        className
      )}
    >
      {/* Left: Menu button and title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground truncate">
          {title}
        </h1>
      </div>

      {/* Right: Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={onNotificationsClick}
      >
        <Bell className="h-5 w-5" />
        {notificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {notificationsCount > 99 ? '99+' : notificationsCount}
          </span>
        )}
      </Button>
    </header>
  );
}

export default MobileHeader;
