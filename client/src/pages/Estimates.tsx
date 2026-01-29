import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Filter, FileText, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { EstimateStats } from '@/components/estimates/EstimateStats';
import { EstimateTable } from '@/components/estimates/EstimateTable';
import { EstimateDetailDialog } from '@/components/estimates/EstimateDetailDialog';
import { EstimateFormDialog } from '@/components/estimates/EstimateFormDialog';
import { EstimateBuilder } from '@/components/estimates/EstimateBuilder';
import { DBEstimateBuilder } from '@/components/estimates/DBEstimateBuilder';
import { TemplatesTab } from '@/components/estimates/TemplatesTab';
import { useEstimates } from '@/hooks/useEstimates';
import { useEstimateTemplates, EstimateTemplate } from '@/hooks/useEstimateTemplates';
import { useDBEstimates, DBEstimate } from '@/hooks/useDBEstimates';
import { Estimate, EstimateStatus } from '@/types/estimate';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/types/financial';
import {
  useDBEstimateLines,
  useCreateDBEstimate,
  useUpdateDBEstimate,
  useDeleteDBEstimate,
  useSubmitDBEstimate,
  useApproveDBEstimate,
  useConvertDBEstimateToBudget,
  useAddDBEstimateLine,
  useUpdateDBEstimateLine,
  useDeleteDBEstimateLine,
  DBEstimateLine,
} from '@/hooks/useDBEstimates';
import { useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Combobox } from '@/components/ui/combobox';
import { useCostCodes } from '@/hooks/useFinancialData';
import { Database, Eye, ArrowRightCircle, CheckCircle, Clock, FileCheck, Loader2, Trash2, Edit, Send, FileCheck2, ArrowRight, PlusCircle, Pencil } from 'lucide-react';

const Estimates = () => {
  const {
    estimates,
    createEstimate,
    updateEstimate,
    duplicateEstimate,
    recalculateTotals,
  } = useEstimates();

  const { data: templates } = useEstimateTemplates();
  const { selectedJobId, selectedJobName } = useJob();
  const { data: dbJobs = [] } = useDBJobs();
  const selectedJob = selectedJobId ? dbJobs.find(j => j.id === selectedJobId) : null;

  // Database estimates from API
  const { data: dbEstimates = [], isLoading: dbLoading } = useDBEstimates(selectedJobId || undefined);

  const [activeTab, setActiveTab] = useState<'estimates' | 'database' | 'templates'>('database');
  const [selectedDBEstimate, setSelectedDBEstimate] = useState<DBEstimate | null>(null);
  const [builderEstimateId, setBuilderEstimateId] = useState<string | null>(null);
  const [showCreateDBEstimate, setShowCreateDBEstimate] = useState(false);
  const [newEstimateTitle, setNewEstimateTitle] = useState('');
  const [newEstimateNotes, setNewEstimateNotes] = useState('');
  const createDBEstimate = useCreateDBEstimate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all');
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [builderEstimate, setBuilderEstimate] = useState<Estimate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EstimateTemplate | null>(null);

  const filteredEstimates = useMemo(() => {
    let filtered = estimates;

    const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();
    const contextJobName = norm(selectedJobName) || norm(selectedJob?.name);
    
    if (selectedJobId) {
      filtered = filtered.filter(e => {
        const estimateJobId = e.jobId != null ? String(e.jobId) : '';
        const contextJobId = String(selectedJobId);
        if (estimateJobId && estimateJobId === contextJobId) return true;
        if (contextJobName && norm(e.projectName) === contextJobName) return true;
        return false;
      });
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(est =>
        est.number?.toLowerCase().includes(query) ||
        est.clientName?.toLowerCase().includes(query) ||
        est.projectName?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [estimates, searchQuery, statusFilter, selectedJobId, selectedJobName, selectedJob?.name]);

  const handleView = (estimate: Estimate) => setSelectedEstimate(estimate);
  
  const handleEdit = (estimate: Estimate) => {
    setBuilderEstimate(estimate);
  };

  const handleDuplicate = (estimate: Estimate) => {
    const duplicated = duplicateEstimate(estimate.id);
    toast.success(`Duplicated ${estimate.number} as ${duplicated.number}`);
  };

  const handleSend = (estimate: Estimate) => {
    updateEstimate(estimate.id, { 
      status: 'sent',
      sentAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    toast.success(`Sent ${estimate.number} to ${estimate.clientName}`);
  };

  const handleNewEstimateClick = () => {
    // Check if there's a default template
    const defaultTemplate = templates?.find(t => t.is_default);
    
    if (selectedJobId) {
      const baseData: Partial<Estimate> = {
        clientName: selectedJob?.client || '',
        projectName: selectedJob?.name || '',
        projectAddress: selectedJob?.address || '',
        jobId: selectedJobId,
      };

      // If there's a default template, merge its sections/settings
      if (defaultTemplate) {
        const newEstimate = createEstimate({
          ...baseData,
          sections: defaultTemplate.sections,
          markupSettings: defaultTemplate.markup_settings,
          exclusions: defaultTemplate.exclusions,
          clarifications: defaultTemplate.clarifications,
          termsAndConditions: defaultTemplate.terms_and_conditions || undefined,
        });
        toast.success(`Created from "${defaultTemplate.name}" template`);
        setBuilderEstimate(newEstimate);
      } else {
        const newEstimate = createEstimate(baseData);
        toast.success('Estimate created');
        setBuilderEstimate(newEstimate);
      }
    } else {
      setFormDialogOpen(true);
    }
  };

  const handleCreateEstimate = (data: Partial<Estimate>) => {
    const newEstimate = createEstimate({
      ...data,
      jobId: data.jobId || selectedJobId || undefined,
    });
    toast.success('Estimate created');
    setBuilderEstimate(newEstimate);
  };

  const handleCreateFromTemplate = (templateData: Partial<Estimate>) => {
    // When creating from template, pre-fill with job context if available
    const baseData: Partial<Estimate> = {
      ...templateData,
      clientName: selectedJob?.client || '',
      projectName: selectedJob?.name || '',
      projectAddress: selectedJob?.address || '',
      jobId: selectedJobId || undefined,
    };

    const newEstimate = createEstimate(baseData);
    toast.success('Estimate created from template');
    setBuilderEstimate(newEstimate);
  };

  const handleEditTemplate = (template: EstimateTemplate) => {
    // For now, convert template to estimate format for editing
    // TODO: Create dedicated template editor
    toast.info('Template editing coming soon. Use "Save as Template" from an estimate to update.');
  };

  const handleBuilderUpdate = useCallback((data: Partial<Estimate>) => {
    if (!builderEstimate) return;
    
    const updated = { ...builderEstimate, ...data };
    const recalculated = recalculateTotals(updated);
    setBuilderEstimate(recalculated);
  }, [builderEstimate, recalculateTotals]);

  const handleBuilderSave = () => {
    if (!builderEstimate) return;
    updateEstimate(builderEstimate.id, builderEstimate);
    toast.success('Estimate saved');
  };

  const handleBuilderSend = () => {
    if (!builderEstimate) return;
    handleSend(builderEstimate);
    setBuilderEstimate(null);
  };

  // If we're in DB builder mode (full-screen), show it
  if (builderEstimateId) {
    return (
      <DBEstimateBuilder
        estimateId={builderEstimateId}
        onBack={() => setBuilderEstimateId(null)}
      />
    );
  }

  // If we're in legacy builder mode, show the builder
  if (builderEstimate) {
    return (
      <div className="h-screen bg-background">
        <EstimateBuilder
          estimate={builderEstimate}
          onUpdate={handleBuilderUpdate}
          onSave={handleBuilderSave}
          onSend={handleBuilderSend}
          onBack={() => {
            handleBuilderSave();
            setBuilderEstimate(null);
          }}
        />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Estimates</h1>
            <p className="text-sm text-muted-foreground">
              Create detailed estimates with assemblies, markups, and cost breakdowns
            </p>
          </div>
          <Button className="gap-2" onClick={handleNewEstimateClick}>
            <Plus className="h-4 w-4" />
            New Estimate
          </Button>
        </div>

        {/* Stats */}
        <EstimateStats estimates={estimates} />

        {/* Tabs for Estimates vs Templates */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'estimates' | 'database' | 'templates')}>
          <TabsList>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              Database ({dbEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="estimates" className="gap-2">
              <FileText className="h-4 w-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layers className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="mt-4 space-y-4">
            {/* Create Button */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedJobId ? `Estimates for ${selectedJob?.name || 'selected job'}` : 'All estimates'}
              </p>
              <Button onClick={() => setShowCreateDBEstimate(true)} disabled={!selectedJobId}>
                <Plus className="h-4 w-4 mr-1" /> New Estimate
              </Button>
            </div>

            {/* Database Estimates from API */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading estimates...
                        </TableCell>
                      </TableRow>
                    ) : dbEstimates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No estimates found. Create one using the "New Estimate" button.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dbEstimates.map((est) => (
                        <TableRow
                          key={est.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setBuilderEstimateId(est.id)}
                        >
                          <TableCell className="font-medium">{est.title}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {est.job?.name || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                est.status === 'converted' ? 'border-green-500 text-green-600 bg-green-50' :
                                est.status === 'approved' ? 'border-blue-500 text-blue-600 bg-blue-50' :
                                est.status === 'submitted' ? 'border-amber-500 text-amber-600 bg-amber-50' :
                                est.status === 'rejected' ? 'border-red-500 text-red-600 bg-red-50' :
                                'border-gray-400 text-gray-600'
                              }
                            >
                              {est.status === 'converted' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {est.status === 'approved' && <FileCheck className="h-3 w-3 mr-1" />}
                              {est.status === 'submitted' && <Clock className="h-3 w-3 mr-1" />}
                              {est.status.charAt(0).toUpperCase() + est.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(est.total_amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {est.line_count}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(est.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                setBuilderEstimateId(est.id);
                              }} title="Open Builder">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDBEstimate(est);
                              }} title="Quick View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {dbEstimates.some(e => e.status === 'converted') && (
              <p className="text-sm text-muted-foreground">
                Converted estimates have been transferred to the job budget.
              </p>
            )}
          </TabsContent>

          <TabsContent value="estimates" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search estimates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EstimateStatus | 'all')}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <EstimateTable
              estimates={filteredEstimates}
              onView={handleView}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onSend={handleSend}
            />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <TemplatesTab
              onCreateFromTemplate={handleCreateFromTemplate}
              onEditTemplate={handleEditTemplate}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <EstimateDetailDialog
        estimate={selectedEstimate}
        open={!!selectedEstimate}
        onOpenChange={(open) => !open && setSelectedEstimate(null)}
        onEdit={(est) => {
          setSelectedEstimate(null);
          handleEdit(est);
        }}
      />

      {/* Create/Edit Form Dialog */}
      <EstimateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        estimate={editingEstimate}
        onSave={handleCreateEstimate}
        selectedJob={selectedJob}
      />

      {/* Database Estimate Detail Dialog */}
      <DBEstimateDialog
        estimate={selectedDBEstimate}
        open={!!selectedDBEstimate}
        onOpenChange={(open) => !open && setSelectedDBEstimate(null)}
      />

      {/* Create Database Estimate Dialog */}
      <Dialog open={showCreateDBEstimate} onOpenChange={setShowCreateDBEstimate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Job</Label>
              <p className="text-sm font-medium">{selectedJob?.name || 'No job selected'}</p>
            </div>
            <div>
              <Label htmlFor="estimate-title">Title</Label>
              <Input
                id="estimate-title"
                value={newEstimateTitle}
                onChange={(e) => setNewEstimateTitle(e.target.value)}
                placeholder="e.g., Initial Budget Estimate"
              />
            </div>
            <div>
              <Label htmlFor="estimate-notes">Notes (optional)</Label>
              <Textarea
                id="estimate-notes"
                value={newEstimateNotes}
                onChange={(e) => setNewEstimateNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateDBEstimate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedJobId || !newEstimateTitle.trim()) {
                    toast.error('Please select a job and enter a title');
                    return;
                  }
                  createDBEstimate.mutate({
                    job_id: selectedJobId,
                    title: newEstimateTitle.trim(),
                    notes: newEstimateNotes.trim() || undefined,
                    created_by: 'Jake Ross',
                  }, {
                    onSuccess: (newEst) => {
                      setShowCreateDBEstimate(false);
                      setNewEstimateTitle('');
                      setNewEstimateNotes('');
                      // Open the builder directly
                      setBuilderEstimateId(newEst.id);
                    },
                  });
                }}
                disabled={createDBEstimate.isPending || !newEstimateTitle.trim()}
              >
                {createDBEstimate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// Database Estimate Detail Dialog Component with CRUD
function DBEstimateDialog({
  estimate,
  open,
  onOpenChange,
}: {
  estimate: DBEstimate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: lines = [], isLoading } = useDBEstimateLines(estimate?.id || '');
  const { data: costCodes = [] } = useCostCodes();
  const queryClient = useQueryClient();

  // Mutations
  const updateEstimate = useUpdateDBEstimate();
  const deleteEstimate = useDeleteDBEstimate();
  const submitEstimate = useSubmitDBEstimate();
  const approveEstimate = useApproveDBEstimate();
  const convertToBudget = useConvertDBEstimateToBudget();
  const addLine = useAddDBEstimateLine();
  const deleteLine = useDeleteDBEstimateLine();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLineCode, setNewLineCode] = useState('');
  const [newLineDesc, setNewLineDesc] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  const [lineToDelete, setLineToDelete] = useState<string | null>(null);

  // Reset state when estimate changes
  useEffect(() => {
    if (estimate) {
      setEditTitle(estimate.title);
      setEditNotes(estimate.notes || '');
      setIsEditing(false);
    }
  }, [estimate?.id]);

  if (!estimate) return null;

  const canEdit = estimate.status === 'draft';
  const canSubmit = estimate.status === 'draft' && lines.length > 0;
  const canApprove = estimate.status === 'submitted';
  const canConvert = estimate.status === 'approved';

  const costCodeOptions = costCodes
    .filter(cc => cc.code && cc.name)
    .map(cc => ({ value: cc.id, label: `${cc.code} - ${cc.name}` }));

  const handleSaveEdit = () => {
    updateEstimate.mutate({
      id: estimate.id,
      title: editTitle,
      notes: editNotes || null,
    }, {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handleDelete = () => {
    deleteEstimate.mutate(estimate.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onOpenChange(false);
      },
    });
  };

  const handleSubmit = () => {
    submitEstimate.mutate({ id: estimate.id, submitted_by: 'Jake Ross' });
  };

  const handleApprove = () => {
    approveEstimate.mutate({ id: estimate.id, approved_by: 'Jake Ross' });
  };

  const handleConvert = () => {
    convertToBudget.mutate({ id: estimate.id, converted_by: 'Jake Ross' });
  };

  const handleAddLine = () => {
    if (!newLineCode || !newLineDesc || !newLineAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    addLine.mutate({
      estimateId: estimate.id,
      cost_code_id: newLineCode,
      description: newLineDesc,
      amount: parseFloat(newLineAmount),
      quantity: 1,
      unit: 'LS',
      unit_cost: parseFloat(newLineAmount),
    }, {
      onSuccess: () => {
        setShowAddLine(false);
        setNewLineCode('');
        setNewLineDesc('');
        setNewLineAmount('');
      },
    });
  };

  const handleDeleteLine = (lineId: string) => {
    deleteLine.mutate({ estimateId: estimate.id, lineId }, {
      onSuccess: () => setLineToDelete(null),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-semibold"
                />
              ) : (
                estimate.title
              )}
              <Badge
                variant="outline"
                className={
                  estimate.status === 'converted' ? 'border-green-500 text-green-600 bg-green-50' :
                  estimate.status === 'approved' ? 'border-blue-500 text-blue-600 bg-blue-50' :
                  estimate.status === 'submitted' ? 'border-amber-500 text-amber-600 bg-amber-50' :
                  estimate.status === 'rejected' ? 'border-red-500 text-red-600 bg-red-50' :
                  'border-gray-400 text-gray-600'
                }
              >
                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {canEdit && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateEstimate.isPending}>
                    {updateEstimate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}
              {canSubmit && (
                <Button variant="outline" size="sm" onClick={handleSubmit} disabled={submitEstimate.isPending}>
                  <Send className="h-4 w-4 mr-1" /> Submit for Approval
                </Button>
              )}
              {canApprove && (
                <Button variant="outline" size="sm" onClick={handleApprove} disabled={approveEstimate.isPending} className="text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
              )}
              {canConvert && (
                <Button variant="outline" size="sm" onClick={handleConvert} disabled={convertToBudget.isPending} className="text-blue-600">
                  <ArrowRight className="h-4 w-4 mr-1" /> Convert to Budget
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-red-600 ml-auto">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Job</p>
                <p className="font-medium">{estimate.job?.name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(estimate.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Line Items</p>
                <p className="font-medium">{lines.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium">{estimate.created_by}</p>
              </div>
            </div>

            {/* Notes */}
            {isEditing ? (
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                />
              </div>
            ) : estimate.notes ? (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{estimate.notes}</p>
              </div>
            ) : null}

            {/* Status History */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>{' '}
                {new Date(estimate.created_at).toLocaleDateString()}
              </div>
              {estimate.submitted_at && (
                <div>
                  <span className="text-muted-foreground">Submitted:</span>{' '}
                  {new Date(estimate.submitted_at).toLocaleDateString()} by {estimate.submitted_by}
                </div>
              )}
              {estimate.approved_at && (
                <div>
                  <span className="text-muted-foreground">Approved:</span>{' '}
                  {new Date(estimate.approved_at).toLocaleDateString()} by {estimate.approved_by}
                </div>
              )}
              {estimate.converted_at && (
                <div>
                  <span className="text-muted-foreground">Converted to Budget:</span>{' '}
                  {new Date(estimate.converted_at).toLocaleDateString()} by {estimate.converted_by}
                </div>
              )}
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Line Items</h3>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddLine(true)}>
                    <PlusCircle className="h-4 w-4 mr-1" /> Add Line
                  </Button>
                )}
              </div>

              {/* Add Line Form */}
              {showAddLine && (
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <Label>Cost Code</Label>
                        <Combobox
                          options={costCodeOptions}
                          value={newLineCode}
                          onValueChange={setNewLineCode}
                          placeholder="Select..."
                          searchPlaceholder="Search cost codes..."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={newLineDesc}
                          onChange={(e) => setNewLineDesc(e.target.value)}
                          placeholder="Line item description"
                        />
                      </div>
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          value={newLineAmount}
                          onChange={(e) => setNewLineAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleAddLine} disabled={addLine.isPending}>
                        {addLine.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Add
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddLine(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : lines.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No line items. {canEdit && 'Click "Add Line" to add one.'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canEdit && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono text-sm">
                          {line.cost_code?.code || '—'}
                        </TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell>{line.unit}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.unit_cost)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(line.amount)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLineToDelete(line.id)}
                              className="text-red-600 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={5} className="text-right">Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(estimate.total_amount)}</TableCell>
                      {canEdit && <TableCell></TableCell>}
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Estimate Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{estimate.title}" and all its line items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEstimate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Line Confirmation */}
      <AlertDialog open={!!lineToDelete} onOpenChange={(open) => !open && setLineToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this line item from the estimate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => lineToDelete && handleDeleteLine(lineToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default Estimates;
