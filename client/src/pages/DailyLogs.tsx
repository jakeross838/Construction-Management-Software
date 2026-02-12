import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search,
  FileText,
  Calendar,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { 
  useDailyLogs, 
  useDailyLogStats,
  DailyLog,
  LogStatus,
} from '@/hooks/useDailyLogs';
import { DailyLogFormDialog } from '@/components/daily-logs/DailyLogFormDialog';
import { DailyLogViewDialog } from '@/components/daily-logs/DailyLogViewDialog';
import { DailyLogCard } from '@/components/daily-logs/DailyLogCard';
import { DailyLogStats } from '@/components/daily-logs/DailyLogStats';

const DailyLogs = () => {
  const { selectedJobId, selectedJobName } = useJob();
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [templateLog, setTemplateLog] = useState<DailyLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<LogStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data fetching - fetch all logs, filter client-side for name fallback
  const { data: logs = [], isLoading } = useDailyLogs(
    null, 
    statusFilter !== 'all' ? statusFilter : null
  );
  const { data: stats, isLoading: statsLoading } = useDailyLogStats(selectedJobId);

  // Filter logs with job context + name fallback
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Apply job filtering with ID + name fallback
    if (selectedJobId) {
      const contextJobId = String(selectedJobId);
      const contextJobName = selectedJobName?.trim().toLowerCase() || '';

      filtered = filtered.filter(log => {
        const logJobId = log.job_id ? String(log.job_id) : '';
        // Primary: ID match
        if (logJobId && logJobId === contextJobId) return true;
        // Fallback: name match
        if (contextJobName && log.jobs?.name?.trim().toLowerCase() === contextJobName) return true;
        return false;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => {
        const matchesSearch = 
          log.jobs?.name?.toLowerCase().includes(query) ||
          log.work_completed?.toLowerCase().includes(query) ||
          log.work_planned?.toLowerCase().includes(query) ||
          log.delays_issues?.toLowerCase().includes(query) ||
          log.created_by?.toLowerCase().includes(query);
        return matchesSearch;
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(log => {
        if (dateFrom && log.log_date < dateFrom) return false;
        if (dateTo && log.log_date > dateTo) return false;
        return true;
      });
    }

    return filtered;
  }, [logs, searchQuery, dateFrom, dateTo, selectedJobId, selectedJobName]);

  const handleViewLog = (log: DailyLog) => {
    setSelectedLog(log);
    setIsViewOpen(true);
    setIsEditing(false);
  };

  const handleEditLog = (log?: DailyLog) => {
    if (log) {
      setSelectedLog(log);
    }
    setIsViewOpen(false);
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedLog(null);
    setTemplateLog(null);
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const handleDuplicateLog = (log: DailyLog) => {
    setSelectedLog(null);
    setTemplateLog(log);
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setSelectedLog(null);
      setTemplateLog(null);
      setIsEditing(false);
    }
  };

  const handleViewClose = (open: boolean) => {
    setIsViewOpen(open);
    if (!open) {
      setSelectedLog(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Daily Logs
            </h1>
            <p className="text-sm text-muted-foreground">
              Document daily progress, crew activity, and site conditions
            </p>
          </div>
          <Button className="gap-2" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            New Daily Log
          </Button>
        </div>

        {/* Stats */}
        <DailyLogStats stats={stats} isLoading={statsLoading} />

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select 
            value={statusFilter} 
            onValueChange={(v) => setStatusFilter(v as LogStatus | 'all')}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">📝 Drafts</SelectItem>
              <SelectItem value="completed">✅ Completed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-[150px]"
              placeholder="From"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-[150px]"
              placeholder="To"
            />
          </div>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-4">
            {filteredLogs.map(log => (
              <DailyLogCard 
                key={log.id} 
                log={log} 
                onClick={() => handleViewLog(log)}
                onEdit={() => handleEditLog(log)}
                onDuplicate={() => handleDuplicateLog(log)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/30 rounded-xl border-2 border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No daily logs found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || dateFrom || dateTo || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start documenting your daily progress'}
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Log
            </Button>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <DailyLogFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        log={isEditing ? selectedLog : null}
        templateLog={templateLog}
        defaultJobId={selectedJobId}
      />

      {/* View Dialog */}
      <DailyLogViewDialog
        open={isViewOpen}
        onOpenChange={handleViewClose}
        log={selectedLog}
        onEdit={handleEditLog}
      />
    </AppLayout>
  );
};

export default DailyLogs;
