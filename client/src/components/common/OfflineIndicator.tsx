/**
 * OfflineIndicator Component
 *
 * Displays a banner when the user is offline or has pending sync items.
 * Provides controls to trigger manual sync and view pending items.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { WifiOff, CloudOff, RefreshCw, ChevronDown, ChevronUp, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePWA } from '@/hooks/usePWA';
import type { OfflineDailyLog, OfflinePhoto, PendingOperation } from '@/utils/offline-storage';

interface OfflineIndicatorProps {
  className?: string;
  showInstallPrompt?: boolean;
}

export function OfflineIndicator({ className, showInstallPrompt = true }: OfflineIndicatorProps) {
  const {
    isOnline,
    isInstallable,
    isInstalled,
    promptInstall,
    syncStatus,
    forceSync,
    getOfflineData,
  } = usePWA();

  const [isExpanded, setIsExpanded] = useState(false);
  const [offlineData, setOfflineData] = useState<{
    dailyLogs: OfflineDailyLog[];
    photos: OfflinePhoto[];
    operations: PendingOperation[];
  } | null>(null);

  // Fetch offline data when expanded
  useEffect(() => {
    if (isExpanded) {
      getOfflineData().then(setOfflineData);
    }
  }, [isExpanded, getOfflineData, syncStatus.pendingCount]);

  // Don't show anything if online, no pending items, and not installable (unless always visible)
  if (isOnline && syncStatus.pendingCount === 0 && (!showInstallPrompt || !isInstallable || isInstalled)) {
    return null;
  }

  const handleSync = async () => {
    await forceSync();
    if (isExpanded) {
      const data = await getOfflineData();
      setOfflineData(data);
    }
  };

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-900/90 text-amber-100 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-medium">You are offline</span>
              <span className="text-xs text-amber-200">
                Changes will be saved locally and synced when online.
              </span>
            </div>
            {syncStatus.pendingCount > 0 && (
              <Badge variant="outline" className="bg-amber-800 border-amber-600 text-amber-100">
                {syncStatus.pendingCount} pending
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Pending Sync Banner (shown when online but has pending items) */}
      {isOnline && syncStatus.pendingCount > 0 && (
        <div className="bg-blue-900/90 text-blue-100 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4" />
              <span className="text-sm font-medium">
                {syncStatus.pendingCount} item{syncStatus.pendingCount !== 1 ? 's' : ''} pending sync
              </span>
              {syncStatus.isSyncing && (
                <RefreshCw className="h-4 w-4 animate-spin ml-2" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-blue-100 hover:text-white hover:bg-blue-800"
                onClick={handleSync}
                disabled={syncStatus.isSyncing}
              >
                {syncStatus.isSyncing ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 p-1 text-blue-100 hover:text-white hover:bg-blue-800"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && offlineData && (
            <div className="max-w-7xl mx-auto mt-2 pb-2 border-t border-blue-700 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Daily Logs */}
                <div>
                  <h4 className="font-medium mb-1">Daily Logs ({offlineData.dailyLogs.length})</h4>
                  {offlineData.dailyLogs.length === 0 ? (
                    <p className="text-blue-300">No pending logs</p>
                  ) : (
                    <ul className="space-y-1">
                      {offlineData.dailyLogs.slice(0, 3).map((log) => (
                        <li key={log.id} className="flex items-center gap-1 text-blue-200">
                          <span className="truncate">{log.log_date}</span>
                          {log.synced && <Check className="h-3 w-3 text-green-400" />}
                        </li>
                      ))}
                      {offlineData.dailyLogs.length > 3 && (
                        <li className="text-blue-300">
                          +{offlineData.dailyLogs.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Photos */}
                <div>
                  <h4 className="font-medium mb-1">Photos ({offlineData.photos.length})</h4>
                  {offlineData.photos.length === 0 ? (
                    <p className="text-blue-300">No pending photos</p>
                  ) : (
                    <ul className="space-y-1">
                      {offlineData.photos.slice(0, 3).map((photo) => (
                        <li key={photo.id} className="flex items-center gap-1 text-blue-200">
                          <span className="truncate">{photo.fileName}</span>
                          {photo.synced && <Check className="h-3 w-3 text-green-400" />}
                        </li>
                      ))}
                      {offlineData.photos.length > 3 && (
                        <li className="text-blue-300">
                          +{offlineData.photos.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Operations */}
                <div>
                  <h4 className="font-medium mb-1">Other Operations ({offlineData.operations.length})</h4>
                  {offlineData.operations.length === 0 ? (
                    <p className="text-blue-300">No pending operations</p>
                  ) : (
                    <ul className="space-y-1">
                      {offlineData.operations.slice(0, 3).map((op) => (
                        <li key={op.id} className="text-blue-200">
                          {op.operationType} {op.entityType}
                        </li>
                      ))}
                      {offlineData.operations.length > 3 && (
                        <li className="text-blue-300">
                          +{offlineData.operations.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {syncStatus.lastSyncAt && (
                <p className="text-xs text-blue-300 mt-2">
                  Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Install Prompt Banner */}
      {showInstallPrompt && isInstallable && !isInstalled && isOnline && syncStatus.pendingCount === 0 && (
        <div className="bg-green-900/90 text-green-100 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="text-sm font-medium">Install App</span>
              <span className="text-xs text-green-200">
                Get quick access and offline support
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-green-100 hover:text-white hover:bg-green-800"
              onClick={handleInstall}
            >
              Install
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact offline indicator for use in headers or sidebars
 */
export function OfflineIndicatorCompact({ className }: { className?: string }) {
  const { isOnline, syncStatus } = usePWA();

  if (isOnline && syncStatus.pendingCount === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!isOnline ? (
        <div className="flex items-center gap-1 text-amber-500" title="You are offline">
          <WifiOff className="h-4 w-4" />
          <span className="text-xs">Offline</span>
        </div>
      ) : syncStatus.pendingCount > 0 ? (
        <div className="flex items-center gap-1 text-blue-500" title="Pending sync">
          <CloudOff className="h-4 w-4" />
          <Badge variant="outline" className="h-5 text-xs px-1.5">
            {syncStatus.pendingCount}
          </Badge>
          {syncStatus.isSyncing && <RefreshCw className="h-3 w-3 animate-spin" />}
        </div>
      ) : null}
    </div>
  );
}

export default OfflineIndicator;
