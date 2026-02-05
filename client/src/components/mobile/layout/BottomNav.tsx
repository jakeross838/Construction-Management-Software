import { NavLink, useLocation } from 'react-router-dom';
import { Home, Clock, Camera, ClipboardList, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/m' },
  { icon: Clock, label: 'Time', path: '/m/time' },
  { icon: Camera, label: 'Photo', path: '/m/photo' },
  { icon: ClipboardList, label: 'Logs', path: '/m/logs' },
  { icon: MoreHorizontal, label: 'More', path: '/m/more' },
];

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-t border-border',
        'h-16 px-2',
        'flex items-center justify-around',
        'safe-area-inset-bottom',
        className
      )}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path ||
          (item.path !== '/m' && location.pathname.startsWith(item.path));

        return (
          <NavLink
            key={item.label}
            to={item.path}
            className={cn(
              'flex flex-col items-center justify-center',
              'w-16 h-full py-1',
              'text-xs font-medium',
              'transition-colors duration-200',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="relative mb-1">
              <item.icon
                className={cn(
                  'h-6 w-6 transition-transform duration-200',
                  isActive && 'scale-110'
                )}
              />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className={cn(isActive && 'font-semibold')}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default BottomNav;
