import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign,
  Mail,
  Clock,
  MoreHorizontal,
  Eye,
  Pencil,
  ArrowRight,
  X,
  CheckCircle2,
  FileText,
  GripVertical,
} from 'lucide-react';
import { LeadFull, sourceConfig } from '@/data/mockLeads';
import { formatCurrency } from '@/data/mockData';
import { LeadStage } from '@/types/job';
import { PipelineStage } from '@/hooks/useDBLeads';

interface LeadKanbanBoardProps {
  leads: LeadFull[];
  stages?: PipelineStage[];
  onView: (lead: LeadFull) => void;
  onEdit: (lead: LeadFull) => void;
  onMoveToStage: (id: string, stage: LeadStage) => void;
  onMoveToNextStage: (id: string) => void;
  onMarkAsLost: (id: string) => void;
  onMarkAsWon: (id: string) => void;
}

// Fallback stages if none provided
const defaultStages: PipelineStage[] = [
  { id: '1', name: 'New Inquiry', slug: 'new_inquiry', color: '#94a3b8', stage_order: 1, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '2', name: 'Initial Contact', slug: 'initial_contact', color: '#60a5fa', stage_order: 2, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '3', name: 'Scope Discussion', slug: 'scope_discussion', color: '#818cf8', stage_order: 3, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '4', name: 'Team Assembly', slug: 'team_assembly', color: '#a78bfa', stage_order: 4, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '5', name: 'Preconstruction Agreement', slug: 'precon_agreement', color: '#c084fc', stage_order: 5, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '6', name: 'Design/Engineering', slug: 'design_engineering', color: '#e879f9', stage_order: 6, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '7', name: 'Preliminary Estimate', slug: 'prelim_estimate', color: '#f472b6', stage_order: 7, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '8', name: 'Budget Review', slug: 'budget_review', color: '#fb7185', stage_order: 8, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '9', name: 'Final Estimate', slug: 'final_estimate', color: '#f97316', stage_order: 9, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '10', name: 'Contract Negotiation', slug: 'contract_negotiation', color: '#facc15', stage_order: 10, is_active: true, is_won_stage: false, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
  { id: '11', name: 'Won', slug: 'won', color: '#22c55e', stage_order: 11, is_active: true, is_won_stage: true, is_lost_stage: false, description: null, required_fields: [], auto_actions: {}, created_at: '' },
];

export function LeadKanbanBoard({
  leads,
  stages,
  onView,
  onEdit,
  onMoveToStage,
  onMoveToNextStage,
  onMarkAsLost,
  onMarkAsWon,
}: LeadKanbanBoardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getLeadsByStage = (stageSlug: string) => {
    return leads.filter(lead => lead.stage === stageSlug);
  };

  // Use provided stages or fallback to defaults, filter out lost stage for kanban view
  const pipelineStages = (stages && stages.length > 0 ? stages : defaultStages)
    .filter(s => !s.is_lost_stage)
    .sort((a, b) => a.stage_order - b.stage_order);

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Get the new stage from destination.droppableId
    const newStage = destination.droppableId as LeadStage;

    // Move the lead to the new stage
    onMoveToStage(draggableId, newStage);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipelineStages.map((stage) => {
          const stageLeads = getLeadsByStage(stage.slug);
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-80">
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="font-medium text-sm">{stage.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(stageValue)}
                </span>
              </div>

              {/* Stage Cards - Droppable Area */}
              <Droppable droppableId={stage.slug}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-3 min-h-[200px] rounded-lg p-3 transition-colors ${
                      snapshot.isDraggingOver
                        ? 'bg-primary/10 ring-2 ring-primary/30'
                        : 'bg-muted/30'
                    }`}
                  >
                    {stageLeads.map((lead, index) => {
                      const source = sourceConfig[lead.source] || sourceConfig.other;

                      return (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`cursor-pointer transition-shadow ${
                                snapshot.isDragging
                                  ? 'shadow-lg ring-2 ring-primary'
                                  : 'hover:shadow-md'
                              }`}
                              onClick={() => onView(lead)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    {/* Drag Handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <Avatar className="h-9 w-9">
                                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {getInitials(lead.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <h4 className="font-medium text-sm">{lead.name}</h4>
                                      <Badge variant="secondary" className={`text-xs ${source.color}`}>
                                        {source.label}
                                      </Badge>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(lead); }}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Lead
                                      </DropdownMenuItem>
                                      {!stage.is_won_stage && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToNextStage(lead.id); }}>
                                            <ArrowRight className="mr-2 h-4 w-4" />
                                            Move to Next Stage
                                          </DropdownMenuItem>
                                          {(stage.slug === 'prelim_estimate' || stage.slug === 'final_estimate') && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); /* TODO: Create Estimate */ }}>
                                              <FileText className="mr-2 h-4 w-4" />
                                              Create Estimate
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-green-600"
                                            onClick={(e) => { e.stopPropagation(); onMarkAsWon(lead.id); }}
                                          >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Mark as Won
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={(e) => { e.stopPropagation(); onMarkAsLost(lead.id); }}
                                          >
                                            <X className="mr-2 h-4 w-4" />
                                            Mark as Lost
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {lead.estimatedValue && (
                                  <div className="flex items-center gap-1 text-sm font-medium text-green-600 mb-2">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    {formatCurrency(lead.estimatedValue)}
                                  </div>
                                )}

                                {lead.projectType && (
                                  <p className="text-xs text-muted-foreground mb-2 capitalize">
                                    {lead.projectType.replace('_', ' ')}
                                    {lead.squareFeet ? ` • ${lead.squareFeet.toLocaleString()} SF` : ''}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {lead.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate max-w-[100px]">{lead.email}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{lead.daysInStage}d</span>
                                  </div>
                                </div>

                                {lead.nextFollowUp && (
                                  <div className="mt-2 pt-2 border-t text-xs">
                                    <span className="text-muted-foreground">Follow up: </span>
                                    <span className="font-medium">
                                      {new Date(lead.nextFollowUp).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}

                    {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No leads in this stage
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
