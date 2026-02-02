import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Users,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  Eye,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useJobs } from '@/hooks/useJobs';
import {
  useClients,
  useCreateClient,
  useSendClientInvitation,
  Client,
} from '@/hooks/useClientPortal';
import { useToast } from '@/hooks/use-toast';

const Clients = () => {
  const { selectedJobId } = useJob();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    job_id: '',
    portal_enabled: true,
    send_invitation: true,
  });

  // Fetch clients with job filter
  const { data: clients = [], isLoading, error } = useClients({
    job_id: selectedJobId || undefined,
  });

  // Fetch jobs for dropdown
  const { data: jobs = [] } = useJobs();

  // Mutations
  const createClient = useCreateClient();
  const sendInvitation = useSendClientInvitation();

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.job?.name?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const stats = useMemo(() => ({
    total: clients.length,
    portalEnabled: clients.filter(c => c.portal_enabled).length,
    recentlyActive: clients.filter(c => {
      if (!c.last_login_at) return false;
      const lastLogin = new Date(c.last_login_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return lastLogin > sevenDaysAgo;
    }).length,
  }), [clients]);

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.email || !newClient.job_id) {
      toast({ title: 'Error', description: 'Name, email, and job are required', variant: 'destructive' });
      return;
    }

    try {
      await createClient.mutateAsync(newClient);
      toast({ title: 'Success', description: 'Client created successfully' });
      setShowCreateDialog(false);
      setNewClient({
        name: '',
        email: '',
        phone: '',
        job_id: '',
        portal_enabled: true,
        send_invitation: true,
      });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleSendInvitation = async (clientId: string) => {
    try {
      await sendInvitation.mutateAsync(clientId);
      toast({ title: 'Success', description: 'Invitation sent' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load clients</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground">Manage homeowner portal access</p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Portal Enabled</p>
                  <p className="text-2xl font-semibold">{stats.portalEnabled}</p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active (7 days)</p>
                  <p className="text-2xl font-semibold">{stats.recentlyActive}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Clients Table */}
        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>No clients found</p>
              {searchQuery && <p className="text-sm">Try adjusting your search</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>
                      {client.job ? (
                        <Badge variant="outline">{client.job.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.portal_enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.last_login_at ? (
                        new Date(client.last_login_at).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.portal_enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleSendInvitation(client.id)}
                          disabled={sendInvitation.isPending}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Invite
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Create Client Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job">Job *</Label>
              <Select
                value={newClient.job_id}
                onValueChange={(value) => setNewClient({ ...newClient, job_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="portal_enabled"
                checked={newClient.portal_enabled}
                onCheckedChange={(checked) =>
                  setNewClient({ ...newClient, portal_enabled: !!checked })
                }
              />
              <Label htmlFor="portal_enabled">Enable portal access</Label>
            </div>

            {newClient.portal_enabled && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_invitation"
                  checked={newClient.send_invitation}
                  onCheckedChange={(checked) =>
                    setNewClient({ ...newClient, send_invitation: !!checked })
                  }
                />
                <Label htmlFor="send_invitation">Send invitation email</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateClient}
              disabled={createClient.isPending}
            >
              {createClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Clients;
