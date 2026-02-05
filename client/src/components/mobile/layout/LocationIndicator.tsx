import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

interface LocationIndicatorProps {
  isTracking: boolean;
  className?: string;
}

export function LocationIndicator({ isTracking, className }: LocationIndicatorProps) {
  if (!isTracking) return null;

  return (
    <div
      className={cn(
        'fixed top-16 right-3 z-50',
        'flex items-center gap-1.5',
        'px-2 py-1 rounded-full',
        'bg-green-500/10 border border-green-500/20',
        className
      )}
      title="Location tracking active"
    >
      {/* Pulsing dot */}
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </div>
      <MapPin className="h-3 w-3 text-green-500" />
      <span className="text-[10px] font-medium text-green-500">GPS</span>
    </div>
  );
}

export default LocationIndicator;
