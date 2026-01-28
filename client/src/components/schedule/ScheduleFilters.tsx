import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Search,
  Filter,
  X,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Layers,
  Wrench,
  RotateCcw,
  CalendarRange,
} from 'lucide-react';
import { 
  TaskStatus, 
  TaskType,
  statusConfig, 
  taskTypeConfig,
  taskColorLegend,
  phaseOptions,
  tradeOptions,
  ScheduleTask,
} from '@/hooks/useScheduleTasks';
import { useVendors } from '@/hooks/useFinancialData';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns';

export type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
export type GroupBy = 'none' | 'phase' | 'trade' | 'status' | 'critical_path';

export interface ScheduleFiltersState {
  search: string;
  timeRange: TimeRange;
  customStartDate: string;
  customEndDate: string;
  statuses: TaskStatus[];
  criticalPathOnly: boolean | null;
  taskTypes: TaskType[];
  phases: string[];
  trades: string[];
  assignedTo: string[];
  confirmedOnly: boolean | null;
  groupBy: GroupBy;
}

interface ScheduleFiltersProps {
  filters: ScheduleFiltersState;
  onFiltersChange: (filters: ScheduleFiltersState) => void;
  taskCount: number;
  filteredCount: number;
}

export const defaultFilters: ScheduleFiltersState = {
  search: '',
  timeRange: 'all',
  customStartDate: '',
  customEndDate: '',
  statuses: [],
  criticalPathOnly: null,
  taskTypes: [],
  phases: [],
  trades: [],
  assignedTo: [],
  confirmedOnly: null,
  groupBy: 'none',
};

export function ScheduleFilters({ filters, onFiltersChange, taskCount, filteredCount }: ScheduleFiltersProps) {
  const { data: vendors = [] } = useVendors();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateFilter = <K extends keyof ScheduleFiltersState>(key: K, value: ScheduleFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = <K extends keyof ScheduleFiltersState>(
    key: K, 
    value: ScheduleFiltersState[K] extends (infer T)[] ? T : never
  ) => {
    const arr = filters[key] as unknown[];
    const newArr = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
    onFiltersChange({ ...filters, [key]: newArr });
  };

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.criticalPathOnly !== null) count++;
    if (filters.taskTypes.length > 0) count++;
    if (filters.phases.length > 0) count++;
    if (filters.trades.length > 0) count++;
    if (filters.assignedTo.length > 0) count++;
    if (filters.confirmedOnly !== null) count++;
    if (filters.timeRange !== 'all') count++;
    if (filters.groupBy !== 'none') count++;
    return count;
  }, [filters]);

  const getDateRangeDisplay = () => {
    const now = new Date();
    switch (filters.timeRange) {
      case 'week':
        return `${format(startOfWeek(now), 'MMM d')} - ${format(endOfWeek(now), 'MMM d, yyyy')}`;
      case 'month':
        return format(now, 'MMMM yyyy');
      case 'quarter':
        return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
      case 'year':
        return now.getFullYear().toString();
      case 'custom':
        if (filters.customStartDate && filters.customEndDate) {
          return `${format(new Date(filters.customStartDate), 'MMM d')} - ${format(new Date(filters.customEndDate), 'MMM d, yyyy')}`;
        }
        return 'Custom Range';
      case 'all':
        return 'All Time';
      default:
        return 'Select Range';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-9 h-9"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => updateFilter('search', '')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Single Filter Button */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Schedule Filters
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-180px)] mt-6 pr-4">
            <div className="space-y-6">
              {/* Time Range */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CalendarRange className="h-3 w-3" />
                  Time Range
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['week', 'month', 'quarter', 'year', 'all'] as TimeRange[]).map(range => (
                    <Button
                      key={range}
                      variant={filters.timeRange === range ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs capitalize"
                      onClick={() => updateFilter('timeRange', range)}
                    >
                      {range}
                    </Button>
                  ))}
                  <Button
                    variant={filters.timeRange === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => updateFilter('timeRange', 'custom')}
                  >
                    Custom
                  </Button>
                </div>
                {filters.timeRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input
                        type="date"
                        value={filters.customStartDate}
                        onChange={(e) => updateFilter('customStartDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input
                        type="date"
                        value={filters.customEndDate}
                        onChange={(e) => updateFilter('customEndDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{getDateRangeDisplay()}</p>
              </div>

              <Separator />

              {/* Group By */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  Group By
                </Label>
                <Select value={filters.groupBy} onValueChange={(v: GroupBy) => updateFilter('groupBy', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="phase">By Phase</SelectItem>
                    <SelectItem value="trade">By Trade</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                    <SelectItem value="critical_path">By Critical Path</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Status Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Status
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <Badge
                      key={value}
                      variant={filters.statuses.includes(value as TaskStatus) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleArrayFilter('statuses', value as TaskStatus)}
                    >
                      {config.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Task Type Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  Task Type
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(taskTypeConfig).map(([value, config]) => (
                    <Badge
                      key={value}
                      variant={filters.taskTypes.includes(value as TaskType) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleArrayFilter('taskTypes', value as TaskType)}
                    >
                      {config.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Critical Path Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  Critical Path
                </Label>
                <div className="flex gap-1.5">
                  <Badge
                    variant={filters.criticalPathOnly === null ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('criticalPathOnly', null)}
                  >
                    All
                  </Badge>
                  <Badge
                    variant={filters.criticalPathOnly === true ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('criticalPathOnly', true)}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Critical Path Only
                  </Badge>
                  <Badge
                    variant={filters.criticalPathOnly === false ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('criticalPathOnly', false)}
                  >
                    Non-Critical
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Phase Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  Phase
                </Label>
                <ScrollArea className="h-36 border rounded-md p-2">
                  <div className="space-y-1">
                    {phaseOptions.map(phase => (
                      <div
                        key={phase}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                        onClick={() => toggleArrayFilter('phases', phase)}
                      >
                        <Checkbox 
                          checked={filters.phases.includes(phase)} 
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{phase}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Trade Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Wrench className="h-3 w-3" />
                  Trade
                </Label>
                <ScrollArea className="h-36 border rounded-md p-2">
                  <div className="space-y-1">
                    {tradeOptions.map(trade => (
                      <div
                        key={trade}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                        onClick={() => toggleArrayFilter('trades', trade)}
                      >
                        <Checkbox 
                          checked={filters.trades.includes(trade)} 
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{trade}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Assigned Sub/Vendor Filter */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  Assigned Sub/Vendor
                </Label>
                <ScrollArea className="h-28 border rounded-md p-2">
                  <div className="space-y-1">
                    {vendors.filter(v => !v.deleted_at).map(vendor => (
                      <div
                        key={vendor.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                        onClick={() => toggleArrayFilter('assignedTo', vendor.id)}
                      >
                        <Checkbox
                          checked={filters.assignedTo.includes(vendor.id)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{vendor.name}</span>
                      </div>
                    ))}
                    {vendors.filter(v => !v.deleted_at).length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">No vendors found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Confirmation Status */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Confirmation Status
                </Label>
                <div className="flex gap-1.5">
                  <Badge
                    variant={filters.confirmedOnly === null ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('confirmedOnly', null)}
                  >
                    All
                  </Badge>
                  <Badge
                    variant={filters.confirmedOnly === true ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('confirmedOnly', true)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Confirmed
                  </Badge>
                  <Badge
                    variant={filters.confirmedOnly === false ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => updateFilter('confirmedOnly', false)}
                  >
                    Unconfirmed
                  </Badge>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Reset All
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {filteredCount} of {taskCount} tasks
              </span>
              <Button size="sm" onClick={() => setFiltersOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active filter count display */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
          <RotateCcw className="h-3 w-3" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}

// Filter application logic
export function applyFilters(tasks: ScheduleTask[], filters: ScheduleFiltersState): ScheduleTask[] {
  return tasks.filter(task => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        task.name?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.phase?.toLowerCase().includes(searchLower) ||
        task.assigned_to?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      let start: Date;
      let end: Date;

      switch (filters.timeRange) {
        case 'week':
          start = startOfWeek(now);
          end = endOfWeek(now);
          break;
        case 'month':
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
        case 'quarter':
          start = startOfQuarter(now);
          end = endOfQuarter(now);
          break;
        case 'year':
          start = startOfYear(now);
          end = endOfYear(now);
          break;
        case 'custom':
          if (filters.customStartDate && filters.customEndDate) {
            start = parseISO(filters.customStartDate);
            end = parseISO(filters.customEndDate);
          } else {
            start = new Date(0);
            end = new Date(8640000000000000);
          }
          break;
        default:
          start = new Date(0);
          end = new Date(8640000000000000);
      }

      // Skip tasks without valid dates
      if (!task.start_date || !task.end_date) return true; // Include tasks without dates

      const taskStart = parseISO(task.start_date);
      const taskEnd = parseISO(task.end_date);

      // Check if task overlaps with the time range
      const overlaps = taskStart <= end && taskEnd >= start;
      if (!overlaps) return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }

    // Critical path filter
    if (filters.criticalPathOnly !== null) {
      if (filters.criticalPathOnly !== task.critical_path) {
        return false;
      }
    }

    // Task type filter
    if (filters.taskTypes.length > 0 && !filters.taskTypes.includes(task.task_type)) {
      return false;
    }

    // Phase filter
    if (filters.phases.length > 0 && (!task.phase || !filters.phases.includes(task.phase))) {
      return false;
    }

    // Trade filter
    if (filters.trades.length > 0) {
      const taskTrades = task.trades || [];
      const hasMatchingTrade = taskTrades.some(t => filters.trades.includes(t));
      if (!hasMatchingTrade) return false;
    }

    // Assigned to filter (by vendor ID stored in assigned_to field)
    if (filters.assignedTo.length > 0) {
      // The assigned_to field stores either vendor name or we need to match against it
      if (!task.assigned_to || !filters.assignedTo.some(id => task.assigned_to?.includes(id))) {
        return false;
      }
    }

    // Confirmation filter
    if (filters.confirmedOnly !== null) {
      const isConfirmed = !!task.confirmed_at;
      if (filters.confirmedOnly !== isConfirmed) return false;
    }

    return true;
  });
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: ScheduleTask[];
}

// Grouping logic
export function groupTasks(tasks: ScheduleTask[], groupBy: GroupBy): TaskGroup[] {
  if (groupBy === 'none') {
    return [];
  }

  const groups: Record<string, ScheduleTask[]> = {};

  tasks.forEach(task => {
    let key: string;

    switch (groupBy) {
      case 'phase':
        key = task.phase || 'Unassigned';
        break;
      case 'trade':
        key = task.trades?.[0] || 'Unassigned';
        break;
      case 'status':
        key = statusConfig[task.status]?.label || task.status;
        break;
      case 'critical_path':
        key = task.critical_path ? 'Critical Path' : 'Non-Critical';
        break;
      default:
        key = 'Other';
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(task);
  });

  return Object.entries(groups).map(([key, taskList]) => ({
    key,
    label: key,
    tasks: taskList,
  }));
}