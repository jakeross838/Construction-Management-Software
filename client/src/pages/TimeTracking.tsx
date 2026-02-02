import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import {
  Clock,
  Play,
  Square,
  Plus,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Loader2,
  Timer,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  useTimeEntries,
  useTimeEntrySummary,
  useClockIn,
  useClockOut,
  useCreateTimeEntry,
  useApproveTimeEntry,
  useRejectTimeEntry,
  useDeleteTimeEntry,
  useBulkApproveTimeEntries,
  getCurrentGPSLocation,
  formatHours,
  formatTimeRange,
  type TimeEntry,
} from '@/hooks/useTimeTracking';

const TimeTracking = () => {
  const { selectedJobId } = useJob();
  const [activeTab, setActiveTab] = useState('entries');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  // Fetch data
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries({
    job_id: selectedJobId || undefined,
    status: statusFilter !== 'all' ? statusFilter as any : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const { data: summary, isLoading: summaryLoading } = useTimeEntrySummary({
    job_id: selectedJobId || undefined,
    period: 'week',
  });

  // Mutations
  const bulkApprove = useBulkApproveTimeEntries();
  const { toast } = useToast();

  // Filter counts
  const entryCounts = useMemo(() => {
    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      approved: entries.filter(e => e.status === 'approved').length,
      rejected: entries.filter(e => e.status === 'rejected').length,
    };
  }, [entries]);

  // Handle bulk approve
  const handleBulkApprove = async () => {
    if (selectedEntries.length === 0) return;
    try {
      await bulkApprove.mutateAsync({ entry_ids: selectedEntries });
      setSelectedEntries([]);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Toggle entry selection
  const toggleEntrySelection = (id: string) => {
    setSelectedEntries(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  // Toggle all pending
  const toggleAllPending = () => {
    const pendingIds = entries.filter(e => e.status === 'pending').map(e => e.id);
    if (pendingIds.every(id => selectedEntries.includes(id))) {
      setSelectedEntries(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedEntries(prev => [...new Set([...prev, ...pendingIds])]);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Time Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Track crew hours, manage timesheets, and process payroll
            </p>
          </div>
          <div className="flex gap-2">
            <ClockInOutButton />
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="This Week"
            value={summary ? formatHours(summary.total_hours) : '-'}
            subtitle={summary ? `${summary.entries} entries` : ''}
            icon={Timer}
            loading={summaryLoading}
          />
          <SummaryCard
            title="Regular Hours"
            value={summary ? formatHours(summary.regular_hours) : '-'}
            subtitle={summary ? `$${summary.regular_pay?.toFixed(0) || 0}` : ''}
            icon={Clock}
            loading={summaryLoading}
          />
          <SummaryCard
            title="Overtime"
            value={summary ? formatHours(summary.overtime_hours) : '-'}
            subtitle={summary ? `$${summary.overtime_pay?.toFixed(0) || 0}` : ''}
            icon={TrendingUp}
            loading={summaryLoading}
          />
          <SummaryCard
            title="Pending Approval"
            value={entryCounts.pending.toString()}
            subtitle="entries"
            icon={AlertTriangle}
            loading={entriesLoading}
            variant={entryCounts.pending > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="entries">
                <Clock className="h-4 w-4 mr-2" />
                Time Entries
              </TabsTrigger>
              <TabsTrigger value="summary">
                <TrendingUp className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
            </TabsList>

            {activeTab === 'entries' && (
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({entryCounts.total})</SelectItem>
                    <SelectItem value="pending">Pending ({entryCounts.pending})</SelectItem>
                    <SelectItem value="approved">Approved ({entryCounts.approved})</SelectItem>
                    <SelectItem value="rejected">Rejected ({entryCounts.rejected})</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px]"
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px]"
                  placeholder="To"
                />
              </div>
            )}
          </div>

          <TabsContent value="entries">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Time Entries</CardTitle>
                  {selectedEntries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedEntries.length} selected
                      </span>
                      <Button
                        size="sm"
                        onClick={handleBulkApprove}
                        disabled={bulkApprove.isPending}
                      >
                        {bulkApprove.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Approve Selected
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No time entries found</p>
                    <p className="text-sm">Adjust filters or create a new entry</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <input
                            type="checkbox"
                            onChange={toggleAllPending}
                            checked={entries.filter(e => e.status === 'pending').every(e => selectedEntries.includes(e.id))}
                            className="rounded border-gray-300"
                          />
                        </TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TimeEntryRow
                          key={entry.id}
                          entry={entry}
                          selected={selectedEntries.includes(entry.id)}
                          onToggleSelect={() => toggleEntrySelection(entry.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            {summaryLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            ) : summary ? (
              <div className="grid gap-4 md:grid-cols-2">
                {/* By Job */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Hours by Job</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.by_job.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No data</p>
                    ) : (
                      <div className="space-y-3">
                        {summary.by_job.map((job) => (
                          <div key={job.job_id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{job.job_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatHours(job.overtime_hours)} OT
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatHours(job.total_hours)}</p>
                              <p className="text-xs text-muted-foreground">
                                ${job.total_pay?.toFixed(0) || 0}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* By Employee */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Hours by Employee</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.by_employee.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No data</p>
                    ) : (
                      <div className="space-y-3">
                        {summary.by_employee.map((emp) => (
                          <div key={emp.employee_id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{emp.employee_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatHours(emp.overtime_hours)} OT
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatHours(emp.total_hours)}</p>
                              <p className="text-xs text-muted-foreground">
                                ${emp.total_pay?.toFixed(0) || 0}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Create Entry Dialog */}
        <CreateTimeEntryDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </AppLayout>
  );
};

// Summary Card Component
function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  variant = 'default'
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  variant?: 'default' | 'warning';
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-20 mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={variant === 'warning' && value !== '0' ? 'border-amber-500/50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Icon className={`h-8 w-8 ${variant === 'warning' && value !== '0' ? 'text-amber-500' : 'text-muted-foreground/50'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// Clock In/Out Button
function ClockInOutButton() {
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { toast } = useToast();
  const { selectedJobId } = useJob();
  const [loading, setLoading] = useState(false);

  // For demo, we'll use a simple toggle. In production, this would check active clock-in status
  const [isClockedIn, setIsClockedIn] = useState(false);

  const handleClockAction = async () => {
    setLoading(true);
    try {
      const gps = await getCurrentGPSLocation().catch(() => null);

      if (isClockedIn) {
        // Clock out
        await clockOut.mutateAsync({
          employee_id: 'demo-employee', // In real app, get from auth context
          gps: gps || undefined,
        });
        setIsClockedIn(false);
      } else {
        // Clock in
        if (!selectedJobId) {
          toast({ title: 'Select a job', description: 'Please select a job to clock in', variant: 'destructive' });
          return;
        }
        await clockIn.mutateAsync({
          job_id: selectedJobId,
          employee_id: 'demo-employee',
          gps: gps || undefined,
        });
        setIsClockedIn(true);
      }
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isClockedIn ? 'destructive' : 'default'}
      onClick={handleClockAction}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : isClockedIn ? (
        <Square className="h-4 w-4 mr-2" />
      ) : (
        <Play className="h-4 w-4 mr-2" />
      )}
      {isClockedIn ? 'Clock Out' : 'Clock In'}
    </Button>
  );
}

// Time Entry Row
function TimeEntryRow({
  entry,
  selected,
  onToggleSelect
}: {
  entry: TimeEntry;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const approveEntry = useApproveTimeEntry();
  const rejectEntry = useRejectTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();

  const handleApprove = async () => {
    try {
      await approveEntry.mutateAsync({ id: entry.id });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    try {
      await rejectEntry.mutateAsync({ id: entry.id, reason: 'Rejected by manager' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry.mutateAsync(entry.id);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const statusBadge = {
    pending: <Badge variant="outline" className="text-amber-600">Pending</Badge>,
    approved: <Badge variant="default" className="bg-green-600">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  }[entry.status];

  return (
    <TableRow>
      <TableCell>
        {entry.status === 'pending' && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="rounded border-gray-300"
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
            {entry.employee?.first_name?.[0]}{entry.employee?.last_name?.[0]}
          </div>
          <div>
            <p className="font-medium text-sm">
              {entry.employee?.first_name} {entry.employee?.last_name}
            </p>
            {entry.cost_code && (
              <p className="text-xs text-muted-foreground">{entry.cost_code.code}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm">{entry.job?.name || '-'}</p>
        {entry.clock_in_geofence_valid === false && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <MapPin className="h-3 w-3" />
            Outside geofence
          </div>
        )}
      </TableCell>
      <TableCell>
        <p className="text-sm">{new Date(entry.date).toLocaleDateString()}</p>
      </TableCell>
      <TableCell>
        <p className="text-sm">{formatTimeRange(entry.clock_in, entry.clock_out)}</p>
        {entry.break_minutes > 0 && (
          <p className="text-xs text-muted-foreground">{entry.break_minutes}m break</p>
        )}
      </TableCell>
      <TableCell className="text-right">
        <p className="font-medium">{formatHours(entry.total_hours)}</p>
        {entry.overtime_hours && entry.overtime_hours > 0 && (
          <p className="text-xs text-amber-600">+{formatHours(entry.overtime_hours)} OT</p>
        )}
      </TableCell>
      <TableCell>{statusBadge}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {entry.status === 'pending' && (
              <>
                <DropdownMenuItem onClick={handleApprove}>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReject}>
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Create Time Entry Dialog
function CreateTimeEntryDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: jobs = [] } = useDBJobs();
  const createEntry = useCreateTimeEntry();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    job_id: '',
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '08:00',
    clock_out: '17:00',
    break_minutes: 30,
    notes: '',
  });

  const handleSubmit = async () => {
    if (!formData.job_id || !formData.employee_id) {
      toast({ title: 'Error', description: 'Job and employee are required', variant: 'destructive' });
      return;
    }

    try {
      await createEntry.mutateAsync({
        job_id: formData.job_id,
        employee_id: formData.employee_id,
        date: formData.date,
        clock_in: `${formData.date}T${formData.clock_in}:00`,
        clock_out: formData.clock_out ? `${formData.date}T${formData.clock_out}:00` : undefined,
        break_minutes: formData.break_minutes,
        notes: formData.notes || undefined,
      });
      onOpenChange(false);
      setFormData({
        job_id: '',
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        clock_in: '08:00',
        clock_out: '17:00',
        break_minutes: 30,
        notes: '',
      });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
          <DialogDescription>
            Manually create a time entry for an employee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Job</Label>
            <Select
              value={formData.job_id}
              onValueChange={(v) => setFormData(d => ({ ...d, job_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input
              value={formData.employee_id}
              onChange={(e) => setFormData(d => ({ ...d, employee_id: e.target.value }))}
              placeholder="Employee ID or name"
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(d => ({ ...d, date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clock In</Label>
              <Input
                type="time"
                value={formData.clock_in}
                onChange={(e) => setFormData(d => ({ ...d, clock_in: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Clock Out</Label>
              <Input
                type="time"
                value={formData.clock_out}
                onChange={(e) => setFormData(d => ({ ...d, clock_out: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Break (minutes)</Label>
            <Input
              type="number"
              value={formData.break_minutes}
              onChange={(e) => setFormData(d => ({ ...d, break_minutes: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createEntry.isPending}>
            {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TimeTracking;
