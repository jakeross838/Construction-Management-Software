import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  Settings,
  History,
  Users,
  FileText,
  DollarSign,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useQuickBooksStatus,
  useQuickBooksSettings,
  useUpdateQuickBooksSettings,
  useDisconnectQuickBooks,
  useSyncVendors,
  useQuickBooksSyncLog,
  getQuickBooksConnectUrl,
  QBOSettings,
  QBOSyncLog,
} from '@/hooks/useQuickBooks';

export function QuickBooksSettings() {
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuickBooksStatus();
  const { data: settings } = useQuickBooksSettings();
  const updateSettings = useUpdateQuickBooksSettings();
  const disconnectQbo = useDisconnectQuickBooks();
  const syncVendors = useSyncVendors();
  const { data: syncLogs = [] } = useQuickBooksSyncLog(10);

  const handleDisconnect = async () => {
    try {
      await disconnectQbo.mutateAsync();
      toast({ title: 'Disconnected', description: 'QuickBooks has been disconnected.' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleSyncVendors = async () => {
    try {
      const result = await syncVendors.mutateAsync();
      toast({
        title: 'Vendor Sync Complete',
        description: `Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`,
      });
    } catch (err) {
      toast({ title: 'Sync Failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleSettingsUpdate = async (updates: Partial<QBOSettings>) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast({ title: 'Settings Updated' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <span className="font-bold text-green-600">QB</span>
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Online</CardTitle>
              <CardDescription>Sync invoices, vendors, and payments</CardDescription>
            </div>
          </div>
          {statusLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status?.connected ? (
            <Badge variant="default" className="gap-1 self-start sm:self-auto">
              <CheckCircle className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="self-start sm:self-auto">Not Connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            {/* Connection Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted rounded-lg gap-3">
              <div>
                <p className="font-medium">{status.companyName}</p>
                <p className="text-sm text-muted-foreground">
                  Last synced: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}
                </p>
                {status.isSandbox && (
                  <Badge variant="outline" className="mt-1">Sandbox</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4 mr-1" /> Settings
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowSyncLog(true)}>
                  <History className="h-4 w-4 mr-1" /> Sync Log
                </Button>
              </div>
            </div>

            {/* Quick Sync Actions */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                className="justify-start"
                onClick={handleSyncVendors}
                disabled={syncVendors.isPending}
              >
                {syncVendors.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Sync Vendors
              </Button>
              <Button variant="outline" className="justify-start" disabled>
                <FileText className="h-4 w-4 mr-2" />
                Sync Bills
                <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
              </Button>
              <Button variant="outline" className="justify-start" disabled>
                <DollarSign className="h-4 w-4 mr-2" />
                Sync Payments
                <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
              </Button>
            </div>

            {/* Recent Sync Status */}
            {syncLogs.length > 0 && (
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Recent Activity</p>
                <div className="space-y-2">
                  {syncLogs.slice(0, 3).map((log) => (
                    <SyncLogItem key={log.id} log={log} />
                  ))}
                </div>
              </div>
            )}

            {/* Disconnect */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectQbo.isPending}
              >
                {disconnectQbo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Disconnect QuickBooks
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your QuickBooks Online account to sync vendors, bills, and payments automatically.
            </p>
            <Button asChild>
              <a href={getQuickBooksConnectUrl()}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect QuickBooks
              </a>
            </Button>
          </div>
        )}
      </CardContent>

      {/* Settings Dialog */}
      <QuickBooksSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSave={handleSettingsUpdate}
        isPending={updateSettings.isPending}
      />

      {/* Sync Log Dialog */}
      <SyncLogDialog
        open={showSyncLog}
        onOpenChange={setShowSyncLog}
        logs={syncLogs}
      />
    </Card>
  );
}

function SyncLogItem({ log }: { log: QBOSyncLog }) {
  const statusColor = {
    pending: 'text-yellow-500',
    in_progress: 'text-blue-500',
    success: 'text-green-500',
    failed: 'text-red-500',
  }[log.status];

  const StatusIcon = {
    pending: RefreshCw,
    in_progress: Loader2,
    success: CheckCircle,
    failed: XCircle,
  }[log.status];

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <StatusIcon className={`h-4 w-4 ${statusColor} ${log.status === 'in_progress' ? 'animate-spin' : ''}`} />
        <span className="capitalize">{log.sync_type.replace('_', ' ')}</span>
        {log.entity_type && (
          <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
        )}
      </div>
      <div className="text-muted-foreground text-xs">
        {log.status === 'success' && (
          <span className="text-green-600 mr-2">
            +{log.records_created} / ~{log.records_updated}
          </span>
        )}
        {log.status === 'failed' && (
          <span className="text-red-600 mr-2">Failed</span>
        )}
        {new Date(log.created_at).toLocaleTimeString()}
      </div>
    </div>
  );
}

interface QuickBooksSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: QBOSettings | null | undefined;
  onSave: (updates: Partial<QBOSettings>) => Promise<void>;
  isPending: boolean;
}

function QuickBooksSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  isPending,
}: QuickBooksSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<Partial<QBOSettings>>({});

  const currentSettings = { ...settings, ...localSettings };

  const handleSave = async () => {
    await onSave(localSettings);
    setLocalSettings({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QuickBooks Settings</DialogTitle>
          <DialogDescription>
            Configure how data syncs between your company and QuickBooks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Auto Sync */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Sync</Label>
              <p className="text-sm text-muted-foreground">Automatically sync data</p>
            </div>
            <Switch
              checked={currentSettings.auto_sync_enabled ?? false}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, auto_sync_enabled: checked })
              }
            />
          </div>

          {/* Sync Frequency */}
          {currentSettings.auto_sync_enabled && (
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select
                value={currentSettings.sync_frequency || 'daily'}
                onValueChange={(value) =>
                  setLocalSettings({
                    ...localSettings,
                    sync_frequency: value as QBOSettings['sync_frequency'],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Sync Options</p>

            <div className="flex items-center justify-between">
              <Label className="font-normal">Sync Vendors</Label>
              <Switch
                checked={currentSettings.sync_vendors ?? true}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, sync_vendors: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="font-normal">Sync Bills</Label>
              <Switch
                checked={currentSettings.sync_bills ?? false}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, sync_bills: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="font-normal">Sync Payments</Label>
              <Switch
                checked={currentSettings.sync_payments ?? false}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, sync_payments: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="font-normal">Use PO Numbers as Reference</Label>
              <Switch
                checked={currentSettings.use_po_numbers_as_ref ?? true}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, use_po_numbers_as_ref: checked })
                }
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Job Sync Mode</p>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">Sync Jobs as Customers</Label>
                <p className="text-xs text-muted-foreground">Create QuickBooks customers for each job</p>
              </div>
              <Switch
                checked={currentSettings.sync_jobs_as_customers ?? false}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, sync_jobs_as_customers: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">Sync Jobs as Classes</Label>
                <p className="text-xs text-muted-foreground">Track jobs using QuickBooks classes</p>
              </div>
              <Switch
                checked={currentSettings.sync_jobs_as_classes ?? false}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, sync_jobs_as_classes: checked })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || Object.keys(localSettings).length === 0}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SyncLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: QBOSyncLog[];
}

function SyncLogDialog({ open, onOpenChange, logs }: SyncLogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sync History</DialogTitle>
          <DialogDescription>
            Recent synchronization activity with QuickBooks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto py-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sync history yet</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">
                      {log.sync_type.replace('_', ' ')}
                    </span>
                    {log.entity_type && (
                      <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                    )}
                  </div>
                  <Badge
                    variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}
                  >
                    {log.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Records: {log.records_processed}</span>
                    <span>Created: {log.records_created}</span>
                    <span>Updated: {log.records_updated}</span>
                  </div>
                  {log.error_message && (
                    <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                      {log.error_message}
                    </div>
                  )}
                  <div className="mt-2 text-xs">
                    {new Date(log.created_at).toLocaleString()}
                    {log.completed_at && (
                      <span className="ml-2">
                        (Duration: {Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at || log.created_at).getTime()) / 1000)}s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickBooksSettings;
