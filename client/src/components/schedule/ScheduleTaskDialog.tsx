import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ScheduleTask, 
  TaskStatus, 
  TaskType,
  Predecessor,
  PredecessorType,
  statusConfig, 
  taskTypeConfig,
  predecessorTypeConfig,
  phaseOptions,
  tradeOptions,
  useScheduleTasks,
} from '@/hooks/useScheduleTasks';
import { useDBJobs, usePurchaseOrders, useVendors } from '@/hooks/useFinancialData';
import { X, Plus } from 'lucide-react';
import { differenceInDays, addDays, parseISO, format } from 'date-fns';

interface ScheduleTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ScheduleTask | null;
  defaultJobId?: string | null;
  onSave: (task: Omit<ScheduleTask, 'id' | 'job_name' | 'created_at' | 'updated_at'>) => void;
}

export function ScheduleTaskDialog({ open, onOpenChange, task, defaultJobId, onSave }: ScheduleTaskDialogProps) {
  const { data: jobs = [] } = useDBJobs();
  const { data: allTasks = [] } = useScheduleTasks(defaultJobId);
  const { data: purchaseOrders = [] } = usePurchaseOrders(defaultJobId || undefined);
  const { data: vendors = [] } = useVendors();
  
  const [form, setForm] = useState({
    job_id: '',
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'scheduled' as TaskStatus,
    critical_path: false,
    task_type: 'work' as TaskType,
    assigned_to: '',
    color: '#eab308',
    parent_task_id: null as string | null,
    sort_order: 0,
    percent_complete: 0,
    phase: '',
    trades: [] as string[],
    tags: [] as string[],
    duration_days: null as number | null,
    po_id: '',
    predecessors: [] as Predecessor[],
    is_confirmed: false,
  });

  const [newTag, setNewTag] = useState('');

  // Calculate available tasks for predecessors (exclude current task)
  const availablePredecessors = useMemo(() => {
    return allTasks.filter(t => t.id !== task?.id).map(t => ({
      value: t.id,
      label: t.name,
      description: `${t.start_date} - ${t.end_date}`,
    }));
  }, [allTasks, task?.id]);

  // PO options for the selected job
  const poOptions: ComboboxOption[] = useMemo(() => {
    return purchaseOrders.map(po => ({
      value: po.id,
      label: po.po_number,
      description: po.vendor_name || undefined,
    }));
  }, [purchaseOrders]);

  // Vendor/Subcontractor options for assignment dropdown
  const vendorOptions: ComboboxOption[] = useMemo(() => {
    return vendors
      .filter(v => v.status === 'active')
      .map(vendor => ({
        value: vendor.id,
        label: vendor.name,
        description: vendor.contact_name || undefined,
      }));
  }, [vendors]);

  useEffect(() => {
    if (task) {
      setForm({
        job_id: task.job_id,
        name: task.name,
        description: task.description || '',
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status,
        critical_path: task.critical_path || false,
        task_type: task.task_type || 'work',
        assigned_to: task.assigned_to || '',
        color: task.color,
        parent_task_id: task.parent_task_id,
        sort_order: task.sort_order,
        percent_complete: task.percent_complete,
        phase: task.phase || '',
        trades: task.trades || [],
        tags: task.tags || [],
        duration_days: task.duration_days,
        po_id: task.po_id || '',
        predecessors: task.predecessors || [],
        is_confirmed: !!task.confirmed_at,
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setForm({
        job_id: defaultJobId || '',
        name: '',
        description: '',
        start_date: today,
        end_date: today,
        status: 'scheduled',
        critical_path: false,
        task_type: 'work',
        assigned_to: '',
        color: '#eab308',
        parent_task_id: null,
        sort_order: 0,
        percent_complete: 0,
        phase: '',
        trades: [],
        tags: [],
        duration_days: null,
        po_id: '',
        predecessors: [],
        is_confirmed: false,
      });
    }
  }, [task, defaultJobId, open]);

  // Calculate duration when dates change
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const days = differenceInDays(parseISO(form.end_date), parseISO(form.start_date)) + 1;
      if (days > 0 && days !== form.duration_days) {
        setForm(prev => ({ ...prev, duration_days: days }));
      }
    }
  }, [form.start_date, form.end_date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.job_id || !form.name || !form.start_date || !form.end_date) return;
    
    // Determine confirmed_at and confirmed_by based on toggle
    let confirmed_at = task?.confirmed_at || null;
    let confirmed_by = task?.confirmed_by || null;
    
    if (form.is_confirmed && !task?.confirmed_at) {
      confirmed_at = new Date().toISOString();
      confirmed_by = 'Current User';
    } else if (!form.is_confirmed && task?.confirmed_at) {
      confirmed_at = null;
      confirmed_by = null;
    }
    
    const { is_confirmed, ...formData } = form;
    
    onSave({
      ...formData,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
      phase: formData.phase || null,
      trades: formData.trades.length > 0 ? formData.trades : null,
      tags: formData.tags.length > 0 ? formData.tags : null,
      po_id: formData.po_id || null,
      predecessors: formData.predecessors,
      task_type: formData.task_type,
      confirmed_at,
      confirmed_by,
    });
    onOpenChange(false);
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleDurationChange = (days: number) => {
    if (form.start_date && days > 0) {
      const newEndDate = format(addDays(parseISO(form.start_date), days - 1), 'yyyy-MM-dd');
      setForm(prev => ({ ...prev, duration_days: days, end_date: newEndDate }));
    }
  };

  const addTag = () => {
    if (newTag.trim() && !form.tags.includes(newTag.trim())) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const toggleTrade = (trade: string) => {
    setForm(prev => ({
      ...prev,
      trades: prev.trades.includes(trade) 
        ? prev.trades.filter(t => t !== trade)
        : [...prev.trades, trade],
    }));
  };

  const addPredecessor = (taskId: string, type: PredecessorType = 'FS') => {
    if (!form.predecessors.some(p => p.task_id === taskId)) {
      setForm(prev => ({
        ...prev,
        predecessors: [...prev.predecessors, { task_id: taskId, type }],
      }));
    }
  };

  const removePredecessor = (taskId: string) => {
    setForm(prev => ({
      ...prev,
      predecessors: prev.predecessors.filter(p => p.task_id !== taskId),
    }));
  };

  const showJobSelector = !defaultJobId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
            <div className="grid gap-4 py-4">
              {showJobSelector && (
                <div className="grid gap-2">
                  <Label htmlFor="job">Job *</Label>
                  <Select value={form.job_id} onValueChange={(v) => updateField('job_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name">Task Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Framing - 2nd Floor"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Task details..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input id="end_date" type="date" value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration (days)</Label>
                  <Input id="duration" type="number" min={1} value={form.duration_days || ''} onChange={(e) => handleDurationChange(Number(e.target.value))} placeholder="Auto" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Task Type</Label>
                  <Select value={form.task_type} onValueChange={(v: TaskType) => updateField('task_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(taskTypeConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Phase</Label>
                  <Select value={form.phase || "none"} onValueChange={(v) => updateField('phase', v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No phase</SelectItem>
                      {phaseOptions.map(phase => (
                        <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: TaskStatus) => updateField('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <Label htmlFor="critical_path" className="cursor-pointer">Critical Path</Label>
                  <Switch id="critical_path" checked={form.critical_path} onCheckedChange={(checked) => updateField('critical_path', checked)} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Assigned Sub/Vendor</Label>
                <Combobox options={vendorOptions} value={form.assigned_to} onValueChange={(v) => updateField('assigned_to', v)} placeholder="Select subcontractor..." searchPlaceholder="Search vendors..." emptyText="No vendors found." />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>% Complete</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={100} value={form.percent_complete} onChange={(e) => updateField('percent_complete', Number(e.target.value))} className="w-20 h-8 text-sm" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <Slider value={[form.percent_complete]} onValueChange={([v]) => updateField('percent_complete', v)} max={100} step={5} className="w-full" />
              </div>

              <div className="grid gap-2">
                <Label>Linked Purchase Order</Label>
                <Combobox options={poOptions} value={form.po_id} onValueChange={(v) => updateField('po_id', v)} placeholder="Link to a PO..." searchPlaceholder="Search POs..." emptyText="No POs found" />
              </div>

              <div className="grid gap-2">
                <Label>Predecessors</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.predecessors.map(pred => {
                    const predTask = allTasks.find(t => t.id === pred.task_id);
                    return predTask ? (
                      <Badge key={pred.task_id} variant="secondary" className="gap-1">
                        <span className="text-xs text-muted-foreground">[{pred.type}]</span>
                        {predTask.name}
                        <button type="button" onClick={() => removePredecessor(pred.task_id)}><X className="h-3 w-3" /></button>
                      </Badge>
                    ) : null;
                  })}
                </div>
                <div className="flex gap-2">
                  <Select value="placeholder_fs" onValueChange={(taskId) => { if (taskId !== "placeholder_fs") addPredecessor(taskId, 'FS'); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Add predecessor (FS)..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placeholder_fs" disabled>Add predecessor (FS)...</SelectItem>
                      {availablePredecessors.filter(p => !form.predecessors.some(pred => pred.task_id === p.value)).map(pred => (
                        <SelectItem key={pred.value} value={pred.value}>{pred.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value="placeholder_ss" onValueChange={(taskId) => { if (taskId !== "placeholder_ss") addPredecessor(taskId, 'SS'); }}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Add SS..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placeholder_ss" disabled>Add SS...</SelectItem>
                      {availablePredecessors.filter(p => !form.predecessors.some(pred => pred.task_id === p.value)).map(pred => (
                        <SelectItem key={pred.value} value={pred.value}>{pred.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Trade(s)</Label>
                <div className="flex flex-wrap gap-2">
                  {tradeOptions.map(trade => (
                    <Badge key={trade} variant={form.trades.includes(trade) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleTrade(trade)}>{trade}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">{tag}<button type="button" onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button></Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a tag..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                  <Button type="button" variant="outline" size="icon" onClick={addTag}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="confirmed" className="text-base font-medium">Confirmed by Subcontractor</Label>
                  <p className="text-sm text-muted-foreground">Mark when the company has confirmed the start date</p>
                </div>
                <Switch id="confirmed" checked={form.is_confirmed} onCheckedChange={(checked) => updateField('is_confirmed', checked)} />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.job_id || !form.name || !form.start_date || !form.end_date}>{task ? 'Save Changes' : 'Add Task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}