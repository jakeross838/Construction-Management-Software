import { useState } from 'react';
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
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import { useJobs } from '@/hooks/useJobs';
import {
  useSubmittals,
  useSubmittalStats,
  Submittal,
  SubmittalStatus,
  submittalStatusConfig,
  submittalTypeConfig,
} from '@/hooks/useSubmittals';
import { SubmittalFormDialog } from '@/components/submittals/SubmittalFormDialog';
import { SubmittalDetailDialog } from '@/components/submittals/SubmittalDetailDialog';
import { CompactStats } from '@/components/ui/compact-stats';

export default function Submittals() {
  const { selectedJobId } = useJob();
  const { data: jobs } = useJobs();
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubmittal, setEditingSubmittal] = useState<Submittal | null>(null);
  const [detailSubmittalId, setDetailSubmittalId] = useState<string | null>(null);

  // Data fetching
  const filterJobId = jobFilter !== 'all' ? jobFilter : undefined;
  const { data: submittals, isLoading } = useSubmittals(filterJobId);
  const { data: stats } = useSubmittalStats(filterJobId);

  // Filter submittals
  const filteredSubmittals = (submittals || []).filter((sub) => {
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        sub.submittal_number.toLowerCase().includes(search) ||
        sub.title.toLowerCase().includes(search) ||
        (sub.spec_section && sub.spec_section.toLowerCase().includes(search)) ||
        (sub.subcontractor && sub.subcontractor.toLowerCase().includes(search)) ||
        (sub.manufacturer && sub.manufacturer.toLowerCase().includes(search))
      );
    }
    return true;
  });

  const handleCreate = () => {
    setEditingSubmittal(null);
    setFormOpen(true);
  };

  const handleEdit = (submittal: Submittal) => {
    setEditingSubmittal(submittal);
    setFormOpen(true);
    setDetailSubmittalId(null);
  };

  const handleRowClick = (submittal: Submittal) => {
    setDetailSubmittalId(submittal.id);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: SubmittalStatus) => {
    switch (status) {
      case 'approved':
      case 'approved_as_noted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'revise_resubmit':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'pending_review':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Edit className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Submittals</h1>
            <p className="text-sm text-muted-foreground">
              Track shop drawings, product data, and samples
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Submittal
          </Button>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search submittals..."
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {(Object.keys(submittalStatusConfig) as SubmittalStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {submittalStatusConfig[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {stats && (
            <CompactStats
              stats={[
                { label: 'Draft', value: stats.draft, icon: Edit, color: 'default' },
                { label: 'Pending', value: stats.pending_review, icon: Clock, color: 'amber' },
                { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'green' },
                { label: 'As Noted', value: stats.approved_as_noted, icon: CheckCircle, color: 'blue' },
                { label: 'Revise', value: stats.revise_resubmit, icon: AlertTriangle, color: 'amber' },
                { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'red' },
              ]}
            />
          )}
        </div>

        {/* Submittal Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubmittals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Submittals Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first submittal to get started'}
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Submittal
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Submittal #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-40">Job</TableHead>
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead className="w-36">Status</TableHead>
                    <TableHead className="w-28">Required</TableHead>
                    <TableHead className="w-32">Subcontractor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmittals.map((submittal) => (
                    <TableRow
                      key={submittal.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(submittal)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{submittal.submittal_number}</span>
                          {submittal.revision !== 'A' && (
                            <Badge variant="outline" className="text-xs">
                              Rev {submittal.revision}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{submittal.title}</span>
                          {submittal.spec_section && (
                            <p className="text-sm text-muted-foreground">
                              {submittal.spec_section}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {submittal.job?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {submittalTypeConfig[submittal.type].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(submittal.status)}
                          <Badge
                            className={cn(
                              submittalStatusConfig[submittal.status].bgColor,
                              submittalStatusConfig[submittal.status].color,
                              'border-0 text-xs'
                            )}
                          >
                            {submittalStatusConfig[submittal.status].label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(submittal.date_required)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {submittal.subcontractor || '-'}
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
      <SubmittalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        submittal={editingSubmittal}
        defaultJobId={jobFilter !== 'all' ? jobFilter : undefined}
      />

      {/* Detail Dialog */}
      <SubmittalDetailDialog
        open={!!detailSubmittalId}
        onOpenChange={(open) => !open && setDetailSubmittalId(null)}
        submittalId={detailSubmittalId}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
}
