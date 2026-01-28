import { useState, useMemo, useCallback } from 'react';
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
import { TemplatesTab } from '@/components/estimates/TemplatesTab';
import { useEstimates } from '@/hooks/useEstimates';
import { useEstimateTemplates, EstimateTemplate } from '@/hooks/useEstimateTemplates';
import { Estimate, EstimateStatus } from '@/types/estimate';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';

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

  const [activeTab, setActiveTab] = useState<'estimates' | 'templates'>('estimates');
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
        est.number.toLowerCase().includes(query) ||
        est.clientName.toLowerCase().includes(query) ||
        est.projectName.toLowerCase().includes(query)
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

  // If we're in builder mode, show the builder
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'estimates' | 'templates')}>
          <TabsList>
            <TabsTrigger value="estimates" className="gap-2">
              <FileText className="h-4 w-4" />
              Estimates
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layers className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

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
    </AppLayout>
  );
};

export default Estimates;
