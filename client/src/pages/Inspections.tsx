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
  ClipboardCheck,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import { useJobs } from '@/hooks/useJobs';
import {
  useInspections,
  Inspection,
  InspectionResult,
  inspectionResultConfig,
} from '@/hooks/useInspections';
import { InspectionFormDialog } from '@/components/inspections/InspectionFormDialog';
import { InspectionDetailDialog } from '@/components/inspections/InspectionDetailDialog';

export default function Inspections() {
  const { selectedJobId } = useJob();
  const { data: jobs } = useJobs();
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId || 'all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [detailInspectionId, setDetailInspectionId] = useState<string | null>(null);

  // Data fetching
  const filterJobId = jobFilter !== 'all' ? jobFilter : undefined;
  const filterResult = resultFilter !== 'all' ? resultFilter : undefined;
  const { data: inspections, isLoading } = useInspections({
    job_id: filterJobId,
    result: filterResult,
  });

  // Filter inspections
  const filteredInspections = (inspections || []).filter((insp) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        insp.inspection_type.toLowerCase().includes(search) ||
        (insp.inspector_name && insp.inspector_name.toLowerCase().includes(search)) ||
        (insp.inspector_agency && insp.inspector_agency.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: filteredInspections.length,
    scheduled: filteredInspections.filter(i => i.result === 'scheduled').length,
    passed: filteredInspections.filter(i => i.result === 'passed').length,
    failed: filteredInspections.filter(i => i.result === 'failed').length,
  };

  const handleCreate = () => {
    setEditingInspection(null);
    setFormOpen(true);
  };

  const handleEdit = (inspection: Inspection) => {
    setEditingInspection(inspection);
    setFormOpen(true);
    setDetailInspectionId(null);
  };

  const handleRowClick = (inspection: Inspection) => {
    setDetailInspectionId(inspection.id);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  const getResultIcon = (result: InspectionResult) => {
    switch (result) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const isUpcoming = (date: string) => {
    const schedDate = new Date(date);
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return schedDate >= today && schedDate <= in7Days;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Inspections</h1>
            <p className="text-sm text-muted-foreground">
              Schedule and track building inspections
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Inspection
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Scheduled</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.scheduled}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Passed</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.passed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Failed</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inspections..."
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
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  {(Object.keys(inspectionResultConfig) as InspectionResult[]).map((result) => (
                    <SelectItem key={result} value={result}>
                      {inspectionResultConfig[result].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInspections.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Inspections Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || resultFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Schedule your first inspection to get started'}
                </p>
                {!searchTerm && resultFilter === 'all' && (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Inspection
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-40">Job</TableHead>
                    <TableHead className="w-32">Inspector</TableHead>
                    <TableHead className="w-28">Result</TableHead>
                    <TableHead className="w-20">Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.map((inspection) => (
                    <TableRow
                      key={inspection.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(inspection)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={cn(
                            'font-medium',
                            inspection.result === 'scheduled' && isUpcoming(inspection.scheduled_date) && 'text-blue-600'
                          )}>
                            {formatDate(inspection.scheduled_date)}
                          </span>
                          {inspection.scheduled_time && (
                            <span className="text-xs text-muted-foreground">
                              {formatTime(inspection.scheduled_time)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inspection.inspection_type}</span>
                          {inspection.reinspection_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Re-insp #{inspection.reinspection_count}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {inspection.job?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inspection.inspector_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResultIcon(inspection.result)}
                          <Badge
                            className={cn(
                              inspectionResultConfig[inspection.result].bgColor,
                              inspectionResultConfig[inspection.result].color,
                              'border-0 text-xs'
                            )}
                          >
                            {inspectionResultConfig[inspection.result].label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {inspection.open_deficiency_count && inspection.open_deficiency_count > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {inspection.open_deficiency_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
      <InspectionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        inspection={editingInspection}
        defaultJobId={jobFilter !== 'all' ? jobFilter : undefined}
      />

      {/* Detail Dialog */}
      <InspectionDetailDialog
        open={!!detailInspectionId}
        onOpenChange={(open) => !open && setDetailInspectionId(null)}
        inspectionId={detailInspectionId}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
}
