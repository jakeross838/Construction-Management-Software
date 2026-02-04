import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  DollarSign,
  Bell,
  Shield,
  Plug,
  Key,
  Webhook,
  CreditCard,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Send,
  Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Integration components and hooks
import { QuickBooksSettings } from '@/components/settings/QuickBooksSettings';
import {
  useXeroStatus,
  useDisconnectXero,
  getXeroConnectUrl,
} from '@/hooks/useXero';
import {
  useSubscription,
  useCreatePortalSession,
  useFeatures,
  useUsage,
  formatPrice,
  getSubscriptionStatusLabel,
} from '@/hooks/useBilling';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  ApiKey,
} from '@/hooks/useApiKeys';
import {
  useWebhooks,
  useWebhookEvents,
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
} from '@/hooks/useWebhooks';
import { TeamManagement } from '@/components/settings/TeamManagement';

const Settings = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const defaultTab = searchParams.get('tab') || 'company';

  // Check for connection success messages
  const qboConnected = searchParams.get('qbo_connected');
  const xeroConnected = searchParams.get('xero_connected');

  if (qboConnected) {
    toast({ title: 'QuickBooks Connected', description: 'Your QuickBooks account has been connected successfully.' });
  }
  if (xeroConnected) {
    toast({ title: 'Xero Connected', description: 'Your Xero account has been connected successfully.' });
  }

  return (
    <AppLayout hideJobSidebar>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and integrations</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="company"><Building2 className="h-4 w-4 mr-1" />Company</TabsTrigger>
            <TabsTrigger value="financial"><DollarSign className="h-4 w-4 mr-1" />Financial</TabsTrigger>
            <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-1" />Integrations</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1" />Billing</TabsTrigger>
            <TabsTrigger value="api"><Key className="h-4 w-4 mr-1" />API</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" />Notifications</TabsTrigger>
            <TabsTrigger value="team"><Users className="h-4 w-4 mr-1" />Team</TabsTrigger>
          </TabsList>

          <TabsContent value="company"><CompanyTab /></TabsContent>
          <TabsContent value="financial"><FinancialTab /></TabsContent>
          <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
          <TabsContent value="billing"><BillingTab /></TabsContent>
          <TabsContent value="api"><ApiTab /></TabsContent>
          <TabsContent value="notifications"><NotificationsTab /></TabsContent>
          <TabsContent value="team"><TeamManagement /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// Company Tab
function CompanyTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Company Name</Label><Input defaultValue="Ross Built Construction" /></div>
          <div><Label>License Number</Label><Input defaultValue="CGC1234567" /></div>
          <div><Label>Phone</Label><Input defaultValue="(941) 555-0100" /></div>
          <div><Label>Email</Label><Input defaultValue="info@rossbuilt.com" /></div>
          <div className="md:col-span-2"><Label>Address</Label><Input defaultValue="123 Main Street, Sarasota, FL 34236" /></div>
        </div>
        <Button>Save Changes</Button>
      </CardContent>
    </Card>
  );
}

// Financial Tab
function FinancialTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Financial Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Default Overhead Rate (%)</Label><Input type="number" defaultValue="15" /></div>
          <div><Label>Default Profit Margin (%)</Label><Input type="number" defaultValue="18" /></div>
          <div><Label>Default Retainage (%)</Label><Input type="number" defaultValue="5" /></div>
          <div><Label>Labor Burden Rate (%)</Label><Input type="number" defaultValue="42" /></div>
        </div>
        <Button>Save Changes</Button>
      </CardContent>
    </Card>
  );
}

// Integrations Tab
function IntegrationsTab() {
  const { data: xeroStatus, isLoading: xeroLoading } = useXeroStatus();
  const disconnectXero = useDisconnectXero();
  const { toast } = useToast();

  const handleDisconnectXero = async () => {
    try {
      await disconnectXero.mutateAsync();
      toast({ title: 'Disconnected', description: 'Xero has been disconnected.' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* QuickBooks - Full Settings Component */}
      <QuickBooksSettings />

      {/* Xero */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="font-bold text-blue-600">X</span>
              </div>
              <div>
                <CardTitle className="text-lg">Xero</CardTitle>
                <CardDescription>Sync contacts, bills, and payments</CardDescription>
              </div>
            </div>
            {xeroLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : xeroStatus?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {xeroStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{xeroStatus.organizationName}</p>
                  <p className="text-sm text-muted-foreground">
                    Last synced: {xeroStatus.lastSyncAt ? new Date(xeroStatus.lastSyncAt).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" /> Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectXero}
                    disabled={disconnectXero.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button asChild>
              <a href={getXeroConnectUrl()}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect Xero
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Billing Tab
function BillingTab() {
  const { data: subscription, isLoading } = useSubscription();
  const { data: usageData } = useUsage();
  const { data: featuresData } = useFeatures();
  const createPortal = useCreatePortalSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{subscription.plan?.name || 'Unknown Plan'}</h3>
                  <p className="text-muted-foreground">
                    {formatPrice(subscription.plan?.monthly_price || 0)}/month
                  </p>
                </div>
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {getSubscriptionStatusLabel(subscription.status)}
                </Badge>
              </div>

              {subscription.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end
                    ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={() => createPortal.mutate()} disabled={createPortal.isPending}>
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Manage Subscription
                </Button>
                <Button variant="outline" asChild>
                  <a href="/plans">View Plans</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No active subscription</p>
              <Button asChild>
                <a href="/plans">Choose a Plan</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      {usageData?.usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <UsageItem
                label="Active Jobs"
                current={usageData.usage.active_jobs.current}
                limit={usageData.usage.active_jobs.limit}
                unlimited={usageData.usage.active_jobs.unlimited}
              />
              <UsageItem
                label="Team Members"
                current={usageData.usage.users.current}
                limit={usageData.usage.users.limit}
                unlimited={usageData.usage.users.unlimited}
              />
              <UsageItem
                label="Storage"
                current={usageData.usage.storage_gb.current}
                limit={usageData.usage.storage_gb.limit}
                unlimited={usageData.usage.storage_gb.unlimited}
                unit="GB"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsageItem({ label, current, limit, unlimited, unit = '' }: {
  label: string;
  current: number;
  limit?: number;
  unlimited: boolean;
  unit?: string;
}) {
  const percentage = unlimited || !limit ? 0 : (current / limit) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">
          {current}{unit} {unlimited ? '/ Unlimited' : limit ? `/ ${limit}${unit}` : ''}
        </span>
      </div>
      {!unlimited && limit && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${percentage > 80 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// API Tab
function ApiTab() {
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <ApiKeysSection
        onCreateClick={() => setShowCreateKey(true)}
        newKey={newKey}
        onNewKeyDismiss={() => setNewKey(null)}
      />
      <WebhooksSection onCreateClick={() => setShowCreateWebhook(true)} />

      <CreateApiKeyDialog
        open={showCreateKey}
        onOpenChange={setShowCreateKey}
        onKeyCreated={(key) => {
          setNewKey(key);
          setShowCreateKey(false);
        }}
      />
      <CreateWebhookDialog
        open={showCreateWebhook}
        onOpenChange={setShowCreateWebhook}
      />
    </div>
  );
}

function ApiKeysSection({ onCreateClick, newKey, onNewKeyDismiss }: {
  onCreateClick: () => void;
  newKey: string | null;
  onNewKeyDismiss: () => void;
}) {
  const { data: keys = [], isLoading } = useApiKeys();
  const revokeKey = useRevokeApiKey();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    try {
      await revokeKey.mutateAsync(id);
      toast({ title: 'API Key Revoked' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for external integrations</CardDescription>
          </div>
          <Button onClick={onCreateClick} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Create Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {newKey && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-600">API Key Created</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Copy this key now. It won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded text-sm font-mono">
                    {newKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(newKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onNewKeyDismiss}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API keys created yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.filter(k => k.is_active).map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{key.key_prefix}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      {key.request_count} requests
                    </p>
                    <p className="text-muted-foreground">
                      Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhooksSection({ onCreateClick }: { onCreateClick: () => void }) {
  const { data: webhooks = [], isLoading } = useWebhooks();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook.mutateAsync(id);
      toast({ title: 'Webhook Deleted' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testWebhook.mutateAsync(id);
      if (result.success) {
        toast({ title: 'Test Successful', description: `Response: ${result.status_code}` });
      } else {
        toast({ title: 'Test Failed', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks
            </CardTitle>
            <CardDescription>Receive real-time notifications for events</CardDescription>
          </div>
          <Button onClick={onCreateClick} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No webhooks configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{webhook.name}</p>
                    {webhook.is_active ? (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{webhook.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {webhook.events.slice(0, 3).map(event => (
                      <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                    ))}
                    {webhook.events.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{webhook.events.length - 3}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(webhook.id)}
                    disabled={testWebhook.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Create API Key Dialog
function CreateApiKeyDialog({ open, onOpenChange, onKeyCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyCreated: (key: string) => void;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const createKey = useCreateApiKey();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    try {
      const result = await createKey.mutateAsync({ name, scopes });
      onKeyCreated(result.api_key);
      setName('');
      setScopes(['read']);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for external integrations. The key will only be shown once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="My Integration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={scopes.includes('read')}
                  onCheckedChange={(checked) => {
                    if (checked) setScopes([...scopes, 'read']);
                    else setScopes(scopes.filter(s => s !== 'read'));
                  }}
                />
                <Label className="font-normal">Read - View data</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={scopes.includes('write')}
                  onCheckedChange={(checked) => {
                    if (checked) setScopes([...scopes, 'write']);
                    else setScopes(scopes.filter(s => s !== 'write'));
                  }}
                />
                <Label className="font-normal">Write - Create and update data</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createKey.isPending}>
            {createKey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Webhook Dialog
function CreateWebhookDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const { data: events = [] } = useWebhookEvents();
  const createWebhook = useCreateWebhook();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !url || selectedEvents.length === 0) {
      toast({ title: 'Error', description: 'Name, URL, and at least one event are required', variant: 'destructive' });
      return;
    }

    try {
      await createWebhook.mutateAsync({ name, url, events: selectedEvents });
      toast({ title: 'Webhook Created' });
      onOpenChange(false);
      setName('');
      setUrl('');
      setSelectedEvents([]);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Group events by category
  const eventsByCategory = events.reduce((acc, event) => {
    const cat = event.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Subscribe to events and receive notifications at your endpoint.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="My Webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <Input
              placeholder="https://example.com/webhooks"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="border rounded-lg p-3 space-y-4 max-h-60 overflow-y-auto">
              {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
                <div key={category}>
                  <p className="text-sm font-medium capitalize mb-2">{category.replace('_', ' ')}</p>
                  <div className="space-y-2 pl-2">
                    {categoryEvents.map((event) => (
                      <div key={event.name} className="flex items-center gap-2">
                        <Switch
                          checked={selectedEvents.includes(event.name)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedEvents([...selectedEvents, event.name]);
                            else setSelectedEvents(selectedEvents.filter(e => e !== event.name));
                          }}
                        />
                        <div>
                          <Label className="font-normal text-sm">{event.name}</Label>
                          {event.description && (
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createWebhook.isPending}>
            {createWebhook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Notifications Tab
function NotificationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Notification settings coming soon...</p>
      </CardContent>
    </Card>
  );
}

export default Settings;
