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
} from 'lucide-react';
import { LeadFull, stageConfig, sourceConfig } from '@/data/mockLeads';
import { formatCurrency } from '@/data/mockData';
import { LeadStage } from '@/types/job';

interface LeadKanbanBoardProps {
  leads: LeadFull[];
  onView: (lead: LeadFull) => void;
  onEdit: (lead: LeadFull) => void;
  onMoveToStage: (id: string, stage: LeadStage) => void;
  onMoveToNextStage: (id: string) => void;
  onMarkAsLost: (id: string) => void;
  onMarkAsWon: (id: string) => void;
}

export function LeadKanbanBoard({
  leads,
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

  const getLeadsByStage = (stageId: LeadStage) => {
    return leads.filter(lead => lead.stage === stageId);
  };

  // Only show active stages in kanban (not lost)
  const activeStages = stageConfig.filter(s => s.id !== 'lost');

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {activeStages.map((stage) => {
        const stageLeads = getLeadsByStage(stage.id);
        const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

        return (
          <div key={stage.id} className="flex-shrink-0 w-80">
            {/* Stage Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                <h3 className="font-medium text-sm">{stage.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stageLeads.length}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(stageValue)}
              </span>
            </div>
            
            {/* Stage Cards */}
            <div className="space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-3">
              {stageLeads.map((lead) => {
                const source = sourceConfig[lead.source] || sourceConfig.other;
                
                return (
                  <Card 
                    key={lead.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onView(lead)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
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
                            {stage.id !== 'won' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToNextStage(lead.id); }}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Move to Next Stage
                                </DropdownMenuItem>
                                {(stage.id === 'estimating' || stage.id === 'proposal_sent') && (
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
                );
              })}
              
              {stageLeads.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No leads in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
