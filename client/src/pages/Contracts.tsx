import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  CheckCircle2,
  Download,
  DollarSign,
  Pen,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useContracts, useContractStats, Contract } from '@/hooks/useContracts';

type ContractStatus = 'draft' | 'active' | 'completed' | 'terminated' | 'expired' | 'cancelled';

const statusConfig: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  completed: { label: 'Completed', variant: 'default' },
  terminated: { label: 'Terminated', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

function formatCurrency(amount: number | undefined): string {
  if (!amount) return '$0';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const Contracts = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Fetch contracts with filters
  const { data: contracts = [], isLoading, error } = useContracts({
    job_id: selectedJobId || undefined,
    search: searchQuery || undefined,
  });

  // Fetch stats
  const { data: stats } = useContractStats(selectedJobId || undefined);

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const query = searchQuery.toLowerCase();
    return contracts.filter(contract =>
      contract.contract_number?.toLowerCase().includes(query) ||
      contract.name?.toLowerCase().includes(query) ||
      contract.job?.name?.toLowerCase().includes(query)
    );
  }, [contracts, searchQuery]);

  const displayStats = useMemo(() => ({
    drafts: stats?.by_status?.draft || 0,
    pending: stats?.pending_signature || 0,
    active: stats?.by_status?.active || 0,
    totalValue: contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.contract_amount || 0), 0),
  }), [stats, contracts]);

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load contracts</p>
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
                  <p className="text-2xl font-semibold">{displayStats.drafts}</p>
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
                  <p className="text-2xl font-semibold">{displayStats.pending}</p>
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
                  <p className="text-2xl font-semibold">{displayStats.active}</p>
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
                  <p className="text-2xl font-semibold">{formatCurrency(displayStats.totalValue)}</p>
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
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileSignature className="h-12 w-12 mb-4" />
              <p>No contracts found</p>
              {searchQuery && <p className="text-sm">Try adjusting your search</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Name / Job</TableHead>
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
                    <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contract.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {contract.job?.name || contract.vendor?.name || contract.company?.name || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(contract.contract_amount)}
                    </TableCell>
                    <TableCell>
                      {contract.start_date ? (
                        <div className="text-sm">
                          <p>{new Date(contract.start_date).toLocaleDateString()}</p>
                          {contract.end_date && (
                            <p className="text-muted-foreground">
                              to {new Date(contract.end_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[contract.status as ContractStatus]?.variant || 'secondary'}>
                        {statusConfig[contract.status as ContractStatus]?.label || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {contract.file_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
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

      {/* Contract Detail Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedContract?.contract_number}</span>
              {selectedContract && (
                <Badge variant={statusConfig[selectedContract.status as ContractStatus]?.variant || 'secondary'}>
                  {statusConfig[selectedContract.status as ContractStatus]?.label || selectedContract.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedContract.name}</p>
                </div>
                {selectedContract.job && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Job</p>
                    <p className="font-medium">{selectedContract.job.name}</p>
                  </div>
                )}
                {selectedContract.vendor && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{selectedContract.vendor.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Contract Amount</p>
                  <p className="font-semibold text-xl text-primary">
                    ${(selectedContract.contract_amount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainage</p>
                  <p className="font-medium">{selectedContract.retainage_percent || 0}%</p>
                </div>
                {selectedContract.start_date && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{new Date(selectedContract.start_date).toLocaleDateString()}</p>
                    </div>
                    {selectedContract.end_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">End Date</p>
                        <p className="font-medium">{new Date(selectedContract.end_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </>
                )}
                {selectedContract.external_signed_at && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Signed</p>
                    <p className="font-medium">
                      {new Date(selectedContract.external_signed_at).toLocaleDateString()}
                      {selectedContract.external_signed_by && ` by ${selectedContract.external_signed_by}`}
                    </p>
                  </div>
                )}
                {selectedContract.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedContract.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {selectedContract.status === 'draft' && (
                  <Button className="flex-1">Send for Signature</Button>
                )}
                {(selectedContract.file_url || selectedContract.signed_file_url) && (
                  <Button variant="outline" className="gap-2" asChild>
                    <a
                      href={selectedContract.signed_file_url || selectedContract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Contracts;
