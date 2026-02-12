import { useNavigate } from 'react-router-dom';
import {
  Bell,
  FileText,
  Landmark,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotificationBell, type BellNotification } from '@/hooks/useNotificationBell';

/**
 * Returns a relative time string like "2 min ago", "1 hr ago", "3 days ago"
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return '';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} wk${weeks > 1 ? 's' : ''} ago`;
}

/**
 * Returns the appropriate icon for a notification type and severity
 */
function getNotificationIcon(notification: BellNotification) {
  const { type, severity } = notification;

  // Type-specific icons
  if (type === 'invoice') {
    return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  if (type === 'draw') {
    return <Landmark className="h-4 w-4 text-purple-500 shrink-0" />;
  }
  if (type === 'activity') {
    return <Activity className="h-4 w-4 text-muted-foreground shrink-0" />;
  }

  // Severity-based icons for generic notifications
  switch (severity) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

interface NotificationItemProps {
  notification: BellNotification;
  onClickNotification: (notification: BellNotification) => void;
}

function NotificationItem({ notification, onClickNotification }: NotificationItemProps) {
  return (
    <button
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
        !notification.read && 'bg-primary/5'
      )}
      onClick={() => onClickNotification(notification)}
    >
      <div className="mt-0.5">
        {getNotificationIcon(notification)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-snug',
          !notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(notification.timestamp)}
        </p>
      </div>
      {!notification.read && (
        <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}

export function NotificationDropdown() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
  } = useNotificationBell();

  const handleClickNotification = (notification: BellNotification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 bg-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Notification List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-0.5">Events will appear here in real time</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClickNotification={handleClickNotification}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationDropdown;
