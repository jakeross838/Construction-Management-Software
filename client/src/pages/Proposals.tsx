import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import { 
  Search, 
  Plus, 
  FileText,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Mail,
  DollarSign,
} from 'lucide-react';
import { jobs } from '@/data/mockData';
import { useJob } from '@/contexts/JobContext';

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

interface Proposal {
  id: string;
  number: string;
  jobId?: string;
  clientName: string;
  clientEmail: string;
  projectName: string;
  description: string;
  totalAmount: number;
  status: ProposalStatus;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  expiresAt?: string;
  viewCount: number;
}

const proposals: Proposal[] = [
  {
    id: '1', number: 'PROP-2026-012', jobId: '1', clientName: 'John & Sarah Drummond', clientEmail: 'drummond@email.com',
    projectName: 'Drummond Custom Home', description: 'New construction - 4,200 SF custom home',
    totalAmount: 1250000, status: 'accepted', createdAt: '2025-09-18', sentAt: '2025-09-19',
    expiresAt: '2025-10-18', viewCount: 5,
  },
  {
    id: '2', number: 'PROP-2026-011', jobId: '5', clientName: 'Carlos & Maria Martinez', clientEmail: 'martinez@email.com',
    projectName: 'Martinez Modern Build', description: 'Contemporary design - 5,800 SF',
    totalAmount: 2100000, status: 'viewed', createdAt: '2026-01-15', sentAt: '2026-01-16',
    viewedAt: '2026-01-17', expiresAt: '2026-02-15', viewCount: 8,
  },
  {
    id: '3', number: 'PROP-2026-010', clientName: 'Thompson Family', clientEmail: 'thompson@email.com',
    projectName: 'Thompson Addition', description: 'Home addition - 1,200 SF',
    totalAmount: 320000, status: 'sent', createdAt: '2026-01-10', sentAt: '2026-01-11',
    expiresAt: '2026-02-10', viewCount: 0,
  },
  {
    id: '4', number: 'PROP-2026-008', clientName: 'Garcia Family', clientEmail: 'garcia@email.com',
    projectName: 'Garcia Renovation', description: 'Full home renovation - 2,800 SF',
    totalAmount: 450000, status: 'declined', createdAt: '2026-01-05', sentAt: '2026-01-06',
    viewedAt: '2026-01-08', expiresAt: '2026-02-05', viewCount: 2,
  },
  {
    id: '5', number: 'PROP-2025-095', jobId: '3', clientName: 'William Patterson', clientEmail: 'patterson@email.com',
    projectName: 'Patterson Luxury Estate', description: 'Luxury estate build - 9,500 SF',
    totalAmount: 3500000, status: 'accepted', createdAt: '2025-11-15', sentAt: '2025-11-16',
    expiresAt: '2025-12-15', viewCount: 4,
  },
  {
    id: '6', number: 'PROP-2026-013', clientName: 'Wilson Project', clientEmail: 'wilson@email.com',
    projectName: 'Wilson Beach House', description: 'Coastal home - 3,200 SF',
    totalAmount: 890000, status: 'draft', createdAt: '2026-01-22', viewCount: 0,
  },
];

const statusConfig: Record<ProposalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  sent: { label: 'Sent', variant: 'default', icon: Send },
  viewed: { label: 'Viewed', variant: 'outline', icon: Eye },
  accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle2 },
  declined: { label: 'Declined', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expired', variant: 'outline', icon: Clock },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
}

const Proposals = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filteredProposals = useMemo(() => {
    let filtered = proposals;
    
    // Filter by selected job
    if (selectedJobId) {
      filtered = filtered.filter(p => p.jobId === selectedJobId);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prop =>
        prop.number.toLowerCase().includes(query) ||
        prop.clientName.toLowerCase().includes(query) ||
        prop.projectName.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [searchQuery, selectedJobId]);

  const stats = useMemo(() => ({
    drafts: proposals.filter(p => p.status === 'draft').length,
    pending: proposals.filter(p => ['sent', 'viewed'].includes(p.status)).length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    totalPending: proposals.filter(p => ['sent', 'viewed'].includes(p.status)).reduce((sum, p) => sum + p.totalAmount, 0),
  }), []);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Proposals</h1>
            <p className="text-sm text-muted-foreground">Generate and send proposals to clients</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-gray-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-semibold">{stats.drafts}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Response</p>
                  <p className="text-2xl font-semibold">{stats.pending}</p>
                </div>
                <Send className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-semibold">{stats.accepted}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Value</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.totalPending)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Proposals Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProposals.map((proposal) => {
                const StatusIcon = statusConfig[proposal.status].icon;
                return (
                  <TableRow 
                    key={proposal.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedProposal(proposal)}
                  >
                    <TableCell className="font-mono text-sm">{proposal.number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{proposal.clientName}</p>
                        <p className="text-sm text-muted-foreground">{proposal.clientEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{proposal.projectName}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(proposal.totalAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span>{proposal.viewCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[proposal.status].variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[proposal.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Proposal Detail Dialog */}
      <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedProposal?.number}</span>
              {selectedProposal && (
                <Badge variant={statusConfig[selectedProposal.status].variant}>
                  {statusConfig[selectedProposal.status].label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedProposal.clientName}</p>
                  <p className="text-sm text-muted-foreground">{selectedProposal.clientEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-xl text-primary">${selectedProposal.totalAmount.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedProposal.projectName}</p>
                  <p className="text-sm text-muted-foreground">{selectedProposal.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(selectedProposal.createdAt).toLocaleDateString()}</p>
                </div>
                {selectedProposal.expiresAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expires</p>
                    <p className="font-medium">{new Date(selectedProposal.expiresAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Views</span>
                  <span className="font-semibold">{selectedProposal.viewCount}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedProposal.status === 'draft' && (
                  <Button className="flex-1 gap-2">
                    <Send className="h-4 w-4" />
                    Send Proposal
                  </Button>
                )}
                {selectedProposal.status === 'sent' && (
                  <Button variant="outline" className="flex-1 gap-2">
                    <Mail className="h-4 w-4" />
                    Resend
                  </Button>
                )}
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Proposals;
