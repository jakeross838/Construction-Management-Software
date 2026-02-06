import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/mobile/usePWAInstall';
import { cn } from '@/lib/utils';

interface PWAInstallBannerProps {
  className?: string;
}

export function PWAInstallBanner({ className }: PWAInstallBannerProps) {
  const { canInstall, isIOS, promptInstall, dismissPrompt } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50',
        'bg-card border border-border rounded-xl shadow-lg',
        'p-4 animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      <button
        onClick={dismissPrompt}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <Download className="h-6 w-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Install App</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen"'
              : 'Install for quick access and offline features'
            }
          </p>

          {!isIOS && (
            <Button
              size="sm"
              className="mt-3"
              onClick={promptInstall}
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          )}

          {isIOS && (
            <div className="flex items-center gap-2 mt-3 text-sm text-primary">
              <Share className="h-4 w-4" />
              <span>Tap Share → Add to Home Screen</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
