import { useState, useMemo, useEffect } from 'react';
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
  FileSignature,
  Clock,
  CheckCircle2,
  Download,
  DollarSign,
  Calendar,
  Pen,
} from 'lucide-react';
import { jobs } from '@/data/mockData';
import { useJob } from '@/contexts/JobContext';

type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'active' | 'completed' | 'terminated';

interface Contract {
  id: string;
  number: string;
  jobId: string;
  clientName: string;
  projectName: string;
  projectAddress: string;
  contractAmount: number;
  status: ContractStatus;
  createdAt: string;
  sentAt?: string;
  signedAt?: string;
  startDate?: string;
  completionDate?: string;
  retainagePercent: number;
}

const contracts: Contract[] = [
  {
    id: '1', number: 'CTR-2026-001', jobId: '1', clientName: 'John & Sarah Drummond', projectName: 'Drummond Residence',
    projectAddress: '501 74th Street, Sarasota, FL 34242', contractAmount: 1250000, status: 'active',
    createdAt: '2025-10-01', sentAt: '2025-10-02', signedAt: '2025-10-10', startDate: '2025-10-15',
    completionDate: '2026-04-30', retainagePercent: 5,
  },
  {
    id: '2', number: 'CTR-2026-002', jobId: '2', clientName: 'Robert & Lisa Crews', projectName: 'Crews Residence',
    projectAddress: '123 Ocean Blvd, Siesta Key, FL 34242', contractAmount: 2100000, status: 'active',
    createdAt: '2025-05-15', sentAt: '2025-05-16', signedAt: '2025-05-25', startDate: '2025-06-01',
    completionDate: '2026-02-28', retainagePercent: 5,
  },
  {
    id: '3', number: 'CTR-2026-003', jobId: '3', clientName: 'William Patterson', projectName: 'Patterson Estate',
    projectAddress: '789 Bay Shore Dr, Longboat Key, FL 34228', contractAmount: 3500000, status: 'pending_signature',
    createdAt: '2026-01-15', sentAt: '2026-01-16', retainagePercent: 5,
  },
  {
    id: '4', number: 'CTR-2025-089', jobId: '4', clientName: 'James & Emily Wilson', projectName: 'Wilson Beach House',
    projectAddress: '456 Gulf View Ave, Anna Maria, FL 34216', contractAmount: 950000, status: 'completed',
    createdAt: '2025-03-01', sentAt: '2025-03-02', signedAt: '2025-03-10', startDate: '2025-03-15',
    completionDate: '2026-01-15', retainagePercent: 5,
  },
  {
    id: '5', number: 'CTR-2026-004', jobId: '5', clientName: 'Carlos & Maria Martinez', projectName: 'Martinez Modern',
    projectAddress: '321 Palm Circle, Venice, FL 34285', contractAmount: 1450000, status: 'draft',
    createdAt: '2026-01-20', retainagePercent: 5,
  },
];

const statusConfig: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_signature: { label: 'Pending Signature', variant: 'outline' },
  signed: { label: 'Signed', variant: 'default' },
  active: { label: 'Active', variant: 'default' },
  completed: { label: 'Completed', variant: 'default' },
  terminated: { label: 'Terminated', variant: 'destructive' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
}

const Contracts = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const filteredContracts = useMemo(() => {
    let filtered = contracts;
    
    // Filter by selected job
    if (selectedJobId) {
      filtered = filtered.filter(c => c.jobId === selectedJobId);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contract =>
        contract.number.toLowerCase().includes(query) ||
        contract.clientName.toLowerCase().includes(query) ||
        contract.projectName.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [searchQuery, selectedJobId]);

  const stats = useMemo(() => ({
    drafts: contracts.filter(c => c.status === 'draft').length,
    pending: contracts.filter(c => c.status === 'pending_signature').length,
    active: contracts.filter(c => c.status === 'active').length,
    totalValue: contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + c.contractAmount, 0),
  }), []);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Contracts</h1>
            <p className="text-sm text-muted-foreground">Manage construction contracts</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Contract
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
                <FileSignature className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Signature</p>
                  <p className="text-2xl font-semibold">{stats.pending}</p>
                </div>
                <Pen className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Contracts</p>
                  <p className="text-2xl font-semibold">{stats.active}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Value</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.totalValue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Contracts Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Client / Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow 
                  key={contract.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedContract(contract)}
                >
                  <TableCell className="font-mono text-sm">{contract.number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{contract.clientName}</p>
                      <p className="text-sm text-muted-foreground">{contract.projectName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(contract.contractAmount)}</TableCell>
                  <TableCell>
                    {contract.startDate ? (
                      <div className="text-sm">
                        <p>{new Date(contract.startDate).toLocaleDateString()}</p>
                        <p className="text-muted-foreground">to {new Date(contract.completionDate!).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[contract.status].variant}>
                      {statusConfig[contract.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Contract Detail Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedContract?.number}</span>
              {selectedContract && (
                <Badge variant={statusConfig[selectedContract.status].variant}>
                  {statusConfig[selectedContract.status].label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedContract.clientName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedContract.projectName}</p>
                  <p className="text-sm text-muted-foreground">{selectedContract.projectAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contract Amount</p>
                  <p className="font-semibold text-xl text-primary">${selectedContract.contractAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainage</p>
                  <p className="font-medium">{selectedContract.retainagePercent}%</p>
                </div>
                {selectedContract.startDate && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{new Date(selectedContract.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completion Date</p>
                      <p className="font-medium">{new Date(selectedContract.completionDate!).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
                {selectedContract.signedAt && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Signed</p>
                    <p className="font-medium">{new Date(selectedContract.signedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {selectedContract.status === 'draft' && (
                  <Button className="flex-1">Send for Signature</Button>
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

export default Contracts;
