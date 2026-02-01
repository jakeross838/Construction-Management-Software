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
} from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import { 
  useDBLeads, 
  useCreateLead, 
  useUpdateLead, 
  useDeleteLead,
  useMoveLeadToStage,
  Lead,
  getNextStage,
} from '@/hooks/useDBLeads';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadDetailDialog } from '@/components/leads/LeadDetailDialog';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { CompactStats } from '@/components/ui/compact-stats';
import { toast } from 'sonner';
import { LeadStage } from '@/types/job';
import { Skeleton } from '@/components/ui/skeleton';

// Transform DB lead to the format expected by components
function transformLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.client_email || '',
    phone: lead.client_phone || '',
    address: lead.address || '',
    source: (lead.source?.toLowerCase().replace(' ', '_') || 'website') as any,
    estimatedValue: lead.estimated_value || 0,
    projectType: 'new_construction' as const,
    projectDescription: lead.description || '',
    projectAddress: lead.address || '',
    squareFeet: lead.square_footage || undefined,
    notes: lead.notes || '',
    stage: lead.stage,
    priority: (lead.priority || 'medium') as 'low' | 'medium' | 'high',
    nextFollowUp: lead.next_follow_up || undefined,
    assignedTo: lead.assigned_to || undefined,
    daysInStage: lead.days_in_stage || 0,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  };
}

const Leads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useDBLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const moveToStage = useMoveLeadToStage();

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(lead =>
      lead.name?.toLowerCase().includes(query) ||
      lead.client_email?.toLowerCase().includes(query) ||
      lead.description?.toLowerCase().includes(query)
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

  const handleConvertToEstimate = (lead: any) => {
    toast.info(`Creating estimate for ${lead.name}...`);
    // TODO: Navigate to estimate creation with lead data pre-filled
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">Track and manage your sales pipeline</p>
          </div>
          <Button onClick={handleAddLead} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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

        {/* Kanban Board */}
        {isLoading ? (
          <div className="grid grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : (
          <LeadKanbanBoard
            leads={transformedLeads}
            onView={handleViewLead}
            onEdit={handleEditLead}
            onMoveToStage={handleMoveToStage}
            onMoveToNextStage={handleMoveToNextStage}
            onMarkAsLost={handleMarkAsLost}
            onMarkAsWon={handleMarkAsWon}
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
      />
    </AppLayout>
  );
};

export default Leads;
