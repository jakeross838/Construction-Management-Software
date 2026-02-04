import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Map,
  Upload,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import {
  useDBLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useMoveLeadToStage,
  usePipelineStages,
  useScoreLead,
  useReviveLead,
  Lead,
  getNextStage,
} from '@/hooks/useDBLeads';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadDetailDialog } from '@/components/leads/LeadDetailDialog';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { LeadMapView } from '@/components/leads/LeadMapView';
import { LostAnalyticsCard } from '@/components/leads/LostAnalyticsCard';
import { PipelineAnalyticsCard } from '@/components/leads/PipelineAnalyticsCard';
import { SourceAnalyticsCard } from '@/components/leads/SourceAnalyticsCard';
import { NotificationSettingsCard } from '@/components/leads/NotificationSettingsCard';
import { LeadImportDialog } from '@/components/leads/LeadImportDialog';
import { ContractBuilder } from '@/components/contracts/ContractBuilder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExportLeads } from '@/hooks/useLeadImports';
import { CompactStats } from '@/components/ui/compact-stats';
import { toast } from 'sonner';
import { LeadStage } from '@/types/job';
import { Skeleton } from '@/components/ui/skeleton';

// Transform DB lead to the format expected by components
function transformLead(lead: Lead) {
  // Calculate days in stage from stage_entered_at
  const stageEnteredAt = lead.stage_entered_at ? new Date(lead.stage_entered_at) : new Date(lead.created_at);
  const daysInStage = Math.floor((Date.now() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: lead.id,
    name: `${lead.first_name} ${lead.last_name}`.trim(),
    email: lead.email || '',
    phone: lead.phone || '',
    address: lead.project_address || '',
    source: (lead.source?.name?.toLowerCase().replace(/\s+/g, '_') || 'website') as any,
    estimatedValue: lead.estimated_value || 0,
    projectType: (lead.project_type || 'new_construction') as any,
    projectDescription: lead.project_description || '',
    projectAddress: lead.project_address || '',
    squareFeet: lead.square_footage || undefined,
    notes: lead.notes || '',
    stage: lead.stage,
    priority: 'medium' as 'low' | 'medium' | 'high',
    nextFollowUp: lead.next_follow_up || undefined,
    assignedTo: lead.assigned_to || undefined,
    daysInStage: daysInStage,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  };
}

type ViewMode = 'kanban' | 'map';

const Leads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showContractBuilder, setShowContractBuilder] = useState(false);
  const [contractLead, setContractLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useDBLeads();
  const { data: pipelineStages = [] } = usePipelineStages();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const moveToStage = useMoveLeadToStage();
  const scoreLead = useScoreLead();
  const exportLeads = useExportLeads();
  const reviveLead = useReviveLead();

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(lead =>
      lead.first_name?.toLowerCase().includes(query) ||
      lead.last_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.project_description?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  const transformedLeads = useMemo(
    () => filteredLeads.map(transformLead),
    [filteredLeads]
  );

  const stats = useMemo(() => ({
    total: leads.length,
    totalValue: leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    newThisWeek: leads.filter(l => l.stage === 'new_inquiry').length,
    conversionRate: leads.length > 0 
      ? ((leads.filter(l => l.stage === 'won').length / 
          leads.filter(l => ['won', 'lost'].includes(l.stage)).length) * 100 || 0).toFixed(0)
      : '0',
  }), [leads]);

  const handleAddLead = () => {
    setEditingLead(null);
    setIsFormOpen(true);
  };

  const handleEditLead = (lead: any) => {
    const dbLead = leads.find(l => l.id === lead.id);
    if (dbLead) {
      setEditingLead(dbLead);
      setViewingLead(null);
      setIsFormOpen(true);
    }
  };

  const handleViewLead = (lead: any) => {
    const dbLead = leads.find(l => l.id === lead.id);
    if (dbLead) {
      setViewingLead(dbLead);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const leadData = {
        name: data.name,
        client_name: data.name,
        client_email: data.email || null,
        client_phone: data.phone || null,
        address: data.projectAddress || data.address || null,
        description: data.projectDescription || null,
        estimated_value: data.estimatedValue || 0,
        square_footage: data.squareFeet || null,
        source: data.source || null,
        priority: 'medium',
        assigned_to: data.assignedTo || null,
        notes: data.notes || null,
        next_follow_up: data.nextFollowUp || null,
      };

      if (editingLead) {
        await updateLead.mutateAsync({ id: editingLead.id, ...leadData });
      } else {
        await createLead.mutateAsync({
          ...leadData,
          stage: 'new_inquiry',
        });
      }
      setIsFormOpen(false);
      setEditingLead(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleMoveToStage = async (leadId: string, stage: LeadStage) => {
    await moveToStage.mutateAsync({ id: leadId, stage });
  };

  const handleMoveToNextStage = async (lead: any) => {
    const nextStage = getNextStage(lead.stage);
    if (nextStage) {
      await moveToStage.mutateAsync({ id: lead.id, stage: nextStage });
    }
  };

  const handleMarkAsLost = async (lead: any) => {
    await moveToStage.mutateAsync({ id: lead.id, stage: 'lost' });
  };

  const handleMarkAsWon = async (lead: any) => {
    await moveToStage.mutateAsync({ id: lead.id, stage: 'won' });
  };

  const handleReviveLead = async (leadId: string) => {
    try {
      await reviveLead.mutateAsync({ leadId, target_stage: 'new_inquiry' });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleConvertToEstimate = (lead: any) => {
    toast.info(`Creating estimate for ${lead.name}...`);
    // TODO: Navigate to estimate creation with lead data pre-filled
  };

  const handleCreateContract = (lead: any) => {
    const dbLead = leads.find(l => l.id === lead.id);
    if (dbLead) {
      setContractLead(dbLead);
      setViewingLead(null); // Close detail dialog
      setShowContractBuilder(true);
    }
  };

  const handleCalculateScore = async (leadId: string) => {
    try {
      await scoreLead.mutateAsync(leadId);
      // Refresh the viewing lead to show updated score
      const updatedLead = leads.find(l => l.id === leadId);
      if (updatedLead) {
        setViewingLead(updatedLead);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <AppLayout hideJobSidebar={true}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">Track and manage your sales pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="gap-1.5"
              >
                <Map className="h-4 w-4" />
                Map
              </Button>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportLeads.mutate({})}
                disabled={exportLeads.isPending}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button onClick={handleAddLead} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
          </div>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="gap-1"
            >
              {showAnalytics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Analytics
            </Button>
          </div>
          <CompactStats
            stats={[
              { label: 'Total', value: stats.total, icon: Target, color: 'default' },
              { label: 'Pipeline', value: formatCurrency(stats.totalValue), icon: DollarSign, color: 'green' },
              { label: 'New This Week', value: stats.newThisWeek, icon: Clock, color: 'blue' },
              { label: 'Win Rate', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'amber' },
            ]}
          />
        </div>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PipelineAnalyticsCard leads={filteredLeads} stages={pipelineStages} />
            <SourceAnalyticsCard leads={filteredLeads} />
            <LostAnalyticsCard />
            <NotificationSettingsCard />
          </div>
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <div className="grid grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          <LeadKanbanBoard
            leads={transformedLeads}
            stages={pipelineStages}
            onView={handleViewLead}
            onEdit={handleEditLead}
            onMoveToStage={handleMoveToStage}
            onMoveToNextStage={handleMoveToNextStage}
            onMarkAsLost={handleMarkAsLost}
            onMarkAsWon={handleMarkAsWon}
            onRevive={handleReviveLead}
          />
        ) : (
          <LeadMapView
            leads={filteredLeads}
            stages={pipelineStages}
            onViewLead={(lead) => setViewingLead(lead)}
          />
        )}
      </div>

      {/* Add/Edit Dialog */}
      <LeadFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lead={editingLead ? transformLead(editingLead) : null}
        onSubmit={handleFormSubmit}
      />

      {/* View Detail Dialog */}
      <LeadDetailDialog
        lead={viewingLead ? transformLead(viewingLead) : null}
        open={!!viewingLead}
        onOpenChange={(open) => !open && setViewingLead(null)}
        onEdit={handleEditLead}
        onMoveToNextStage={handleMoveToNextStage}
        onMarkAsWon={handleMarkAsWon}
        onMarkAsLost={handleMarkAsLost}
        onConvertToEstimate={handleConvertToEstimate}
        onCreateContract={handleCreateContract}
        onCalculateScore={handleCalculateScore}
        stages={pipelineStages}
        score={viewingLead?.qualification_score}
        scoreBreakdown={viewingLead?.score_breakdown}
      />

      {/* Import Dialog */}
      <LeadImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />

      {/* Contract Builder Dialog */}
      <Dialog open={showContractBuilder} onOpenChange={setShowContractBuilder}>
        <DialogContent
          className="max-w-5xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              Create Contract {contractLead && `for ${contractLead.first_name} ${contractLead.last_name}`}
            </DialogTitle>
          </DialogHeader>
          <ContractBuilder
            leadId={contractLead?.id}
            onSave={(contractId) => {
              setShowContractBuilder(false);
              setContractLead(null);
              toast.success('Contract created successfully');
            }}
            onCancel={() => {
              setShowContractBuilder(false);
              setContractLead(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Leads;
