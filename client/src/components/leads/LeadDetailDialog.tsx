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
} from 'lucide-react';
import { LeadFull, stageConfig, sourceConfig, projectTypeOptions } from '@/data/mockLeads';
import { formatCurrency } from '@/data/mockData';

interface LeadDetailDialogProps {
  lead: LeadFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: LeadFull) => void;
  onMoveToNextStage: (id: string) => void;
  onMarkAsWon: (id: string) => void;
  onMarkAsLost: (id: string) => void;
  onConvertToEstimate?: (lead: LeadFull) => void;
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
}: LeadDetailDialogProps) {
  if (!lead) return null;

  const stageInfo = stageConfig.find(s => s.id === lead.stage);
  const sourceInfo = sourceConfig[lead.source] || sourceConfig.other;
  const projectTypeLabel = projectTypeOptions.find(p => p.value === lead.projectType)?.label;

  const canMoveForward = !['won', 'lost'].includes(lead.stage);
  const canConvert = lead.stage === 'estimating' || lead.stage === 'proposal_sent';

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
                    <div className={`h-2 w-2 rounded-full ${stageInfo.color}`} />
                    {stageInfo.label}
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
            <div className="flex gap-2">
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
                onClick={() => onMarkAsLost(lead.id)}
              >
                <X className="h-4 w-4 mr-2 text-destructive" />
                Lost
              </Button>
            </div>
          )}

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
                Activity
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
