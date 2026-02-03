import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  Ruler,
  FileText,
  ArrowRight,
  Pencil,
  X,
  CheckCircle2,
  Clock,
  Target,
  Zap,
  Home,
  Users,
  Timer,
  Sparkles,
  MessageSquare,
  FolderOpen,
  Briefcase,
  RefreshCw,
} from 'lucide-react';
import { ActivityTimeline } from './ActivityTimeline';
import { LeadDocuments } from './LeadDocuments';
import { PreconAgreementCard } from './PreconAgreementCard';
import { LeadEstimates } from './LeadEstimates';
import { LostLeadDialog } from './LostLeadDialog';
import { ReviveLeadDialog } from './ReviveLeadDialog';
import { LeadFull, sourceConfig, projectTypeOptions } from '@/data/mockLeads';
import { formatCurrency } from '@/data/mockData';
import { PipelineStage, useConvertLeadToJob } from '@/hooks/useDBLeads';

interface ScoreBreakdown {
  budget?: number;
  land?: number;
  source?: number;
  timeline?: number;
  readiness?: number;
}

interface LeadDetailDialogProps {
  lead: LeadFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: LeadFull) => void;
  onMoveToNextStage: (id: string) => void;
  onMarkAsWon: (id: string) => void;
  onMarkAsLost: (id: string) => void;
  onConvertToEstimate?: (lead: LeadFull) => void;
  onCalculateScore?: (id: string) => void;
  stages?: PipelineStage[];
  score?: number | null;
  scoreBreakdown?: ScoreBreakdown | null;
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  onEdit,
  onMoveToNextStage,
  onMarkAsWon,
  onMarkAsLost,
  onConvertToEstimate,
  onCalculateScore,
  stages,
  score,
  scoreBreakdown,
}: LeadDetailDialogProps) {
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showReviveDialog, setShowReviveDialog] = useState(false);
  const convertToJob = useConvertLeadToJob();

  if (!lead) return null;

  // Find stage from database stages or use fallback
  const stageInfo = stages?.find(s => s.slug === lead.stage);
  const sourceInfo = sourceConfig[lead.source] || sourceConfig.other;
  const projectTypeLabel = projectTypeOptions.find(p => p.value === lead.projectType)?.label;

  const canMoveForward = !['won', 'lost'].includes(lead.stage);
  const canConvert = ['prelim_estimate', 'final_estimate', 'budget_review'].includes(lead.stage);
  const isWon = lead.stage === 'won';
  const canConvertToJob = isWon && !lead.jobId;

  const handleConvertToJob = async () => {
    if (!confirm('Convert this lead to an active job? This will create a new job with the lead information.')) return;
    await convertToJob.mutateAsync({
      leadId: lead.id,
      contractAmount: lead.estimatedValue,
    });
    onOpenChange(false);
  };

  // Score color based on value
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    if (s >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Hot Lead';
    if (s >= 60) return 'Warm Lead';
    if (s >= 40) return 'Cool Lead';
    return 'Cold Lead';
  };

  const scoreIcons: Record<string, { icon: typeof DollarSign; label: string; max: number }> = {
    budget: { icon: DollarSign, label: 'Budget', max: 30 },
    land: { icon: Home, label: 'Land Status', max: 25 },
    source: { icon: Users, label: 'Lead Source', max: 20 },
    timeline: { icon: Timer, label: 'Timeline', max: 15 },
    readiness: { icon: Sparkles, label: 'Readiness', max: 10 },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{lead.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={sourceInfo.color}>{sourceInfo.label}</Badge>
                {stageInfo && (
                  <Badge variant="outline" className="gap-1">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stageInfo.color }}
                    />
                    {stageInfo.name}
                  </Badge>
                )}
                {score !== null && score !== undefined && (
                  <Badge variant="secondary" className={`gap-1 ${getScoreColor(score)}`}>
                    <Target className="h-3 w-3" />
                    {score}/100
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Quick Actions */}
          {canMoveForward && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => onMoveToNextStage(lead.id)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Move to Next Stage
              </Button>
              {canConvert && onConvertToEstimate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onConvertToEstimate(lead)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create Estimate
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMarkAsWon(lead.id)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLostDialog(true)}
              >
                <X className="h-4 w-4 mr-2 text-destructive" />
                Lost
              </Button>
            </div>
          )}

          {/* Revive Lost Lead Action */}
          {lead.stage === 'lost' && (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => setShowReviveDialog(true)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Revive Lead
              </Button>
            </div>
          )}

          {/* Convert to Job Action (for won leads) */}
          {canConvertToJob && (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConvertToJob}
                disabled={convertToJob.isPending}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                {convertToJob.isPending ? 'Converting...' : 'Convert to Active Job'}
              </Button>
            </div>
          )}

          {/* Already Converted Badge */}
          {isWon && lead.jobId && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Converted to Job</p>
                <p className="text-sm text-green-600">This lead has been converted to an active job</p>
              </div>
            </div>
          )}

          {/* Lead Score Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Lead Score
                </div>
                {onCalculateScore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCalculateScore(lead.id)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {score ? 'Recalculate' : 'Calculate Score'}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {score !== null && score !== undefined ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                      {score}
                    </div>
                    <div>
                      <p className={`font-medium ${getScoreColor(score)}`}>
                        {getScoreLabel(score)}
                      </p>
                      <p className="text-sm text-muted-foreground">out of 100 points</p>
                    </div>
                  </div>
                  <Progress value={score} className="h-2" />

                  {/* Score Breakdown */}
                  {scoreBreakdown && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {Object.entries(scoreBreakdown).map(([key, value]) => {
                        const info = scoreIcons[key];
                        if (!info || value === undefined) return null;
                        const Icon = info.icon;
                        const percentage = (value / info.max) * 100;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span>{info.label}</span>
                                <span className="font-medium">{value}/{info.max}</span>
                              </div>
                              <Progress value={percentage} className="h-1" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No score calculated yet</p>
                  <p className="text-xs">Click "Calculate Score" to assess this lead</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {lead.estimatedValue && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Estimated Value
                    </p>
                    <p className="font-semibold text-lg text-green-600">
                      {formatCurrency(lead.estimatedValue)}
                    </p>
                  </div>
                )}
                {projectTypeLabel && (
                  <div>
                    <p className="text-muted-foreground">Project Type</p>
                    <p className="font-medium">{projectTypeLabel}</p>
                  </div>
                )}
                {lead.squareFeet && lead.squareFeet > 0 && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      Square Feet
                    </p>
                    <p className="font-medium">{lead.squareFeet.toLocaleString()} SF</p>
                  </div>
                )}
                {lead.projectAddress && (
                  <div>
                    <p className="text-muted-foreground">Project Location</p>
                    <p className="font-medium">{lead.projectAddress}</p>
                  </div>
                )}
              </div>

              {lead.projectDescription && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Description</p>
                  <p>{lead.projectDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity & Follow Up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Days in Stage</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{lead.daysInStage} days</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(lead.createdAt).toLocaleDateString()}</p>
                </div>
                {lead.assignedTo && (
                  <div>
                    <p className="text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{lead.assignedTo}</p>
                  </div>
                )}
                {lead.nextFollowUp && (
                  <div>
                    <p className="text-muted-foreground">Next Follow Up</p>
                    <p className="font-medium">{new Date(lead.nextFollowUp).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {lead.notes && (
                <>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <ActivityTimeline leadId={lead.id} />

          {/* Preconstruction Agreement */}
          <PreconAgreementCard lead={lead as any} />

          {/* Estimates */}
          <LeadEstimates leadId={lead.id} leadName={lead.name} />

          {/* Documents */}
          <LeadDocuments leadId={lead.id} />
        </div>

        {/* Lost Lead Dialog */}
        <LostLeadDialog
          leadId={lead.id}
          leadName={lead.name}
          open={showLostDialog}
          onOpenChange={setShowLostDialog}
          onSuccess={() => onOpenChange(false)}
        />

        {/* Revive Lead Dialog */}
        <ReviveLeadDialog
          leadId={lead.id}
          leadName={lead.name}
          previousReason={(lead as any).lost_reason}
          previousCompetitor={(lead as any).lost_competitor}
          open={showReviveDialog}
          onOpenChange={setShowReviveDialog}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
