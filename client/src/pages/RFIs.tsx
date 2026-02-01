import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import { useJobs } from '@/hooks/useJobs';
import {
  useRFIs,
  useRFIStats,
  RFI,
  RFIStatus,
  rfiStatusConfig,
  rfiPriorityConfig,
} from '@/hooks/useRFIs';
import { RFIFormDialog } from '@/components/rfis/RFIFormDialog';
import { RFIDetailDialog } from '@/components/rfis/RFIDetailDialog';

export default function RFIs() {
  const { selectedJobId } = useJob();
  const { data: jobs } = useJobs();
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingRFI, setEditingRFI] = useState<RFI | null>(null);
  const [detailRfiId, setDetailRfiId] = useState<string | null>(null);

  // Data fetching
  const filterJobId = jobFilter !== 'all' ? jobFilter : undefined;
  const { data: rfis, isLoading } = useRFIs(filterJobId);
  const { data: stats } = useRFIStats(filterJobId);

  // Filter RFIs
  const filteredRFIs = (rfis || []).filter((rfi) => {
    if (statusFilter !== 'all' && rfi.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        rfi.rfi_number.toLowerCase().includes(search) ||
        rfi.subject.toLowerCase().includes(search) ||
        rfi.question.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const handleCreate = () => {
    setEditingRFI(null);
    setFormOpen(true);
  };

  const handleEdit = (rfi: RFI) => {
    setEditingRFI(rfi);
    setFormOpen(true);
    setDetailRfiId(null);
  };

  const handleRowClick = (rfi: RFI) => {
    setDetailRfiId(rfi.id);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (rfi: RFI) => {
    if (!rfi.due_date || rfi.status === 'closed' || rfi.status === 'answered') return false;
    return new Date(rfi.due_date) < new Date();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">RFIs</h1>
            <p className="text-sm text-muted-foreground">
              Manage requests for information
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create RFI
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Open</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.open}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pending</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Answered</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.answered}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-muted-foreground">Closed</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.closed}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search RFIs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {(Object.keys(rfiStatusConfig) as RFIStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {rfiStatusConfig[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* RFI Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRFIs.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No RFIs Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first RFI to get started'}
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create RFI
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">RFI #</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-40">Job</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-28">Due Date</TableHead>
                    <TableHead className="w-32">Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRFIs.map((rfi) => (
                    <TableRow
                      key={rfi.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(rfi)}
                    >
                      <TableCell className="font-mono text-sm">
                        {rfi.rfi_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{rfi.subject}</span>
                          <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {rfi.question}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rfi.job?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            rfiPriorityConfig[rfi.priority].bgColor,
                            rfiPriorityConfig[rfi.priority].color,
                            'border-0'
                          )}
                        >
                          {rfiPriorityConfig[rfi.priority].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            rfiStatusConfig[rfi.status].bgColor,
                            rfiStatusConfig[rfi.status].color,
                            'border-0'
                          )}
                        >
                          {rfiStatusConfig[rfi.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={cn(isOverdue(rfi) && 'text-red-500 font-medium')}>
                          {formatDate(rfi.due_date)}
                          {isOverdue(rfi) && (
                            <AlertTriangle className="inline h-3 w-3 ml-1" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rfi.assigned_to || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <RFIFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rfi={editingRFI}
        defaultJobId={jobFilter !== 'all' ? jobFilter : undefined}
      />

      {/* Detail Dialog */}
      <RFIDetailDialog
        open={!!detailRfiId}
        onOpenChange={(open) => !open && setDetailRfiId(null)}
        rfiId={detailRfiId}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
}
