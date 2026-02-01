import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useChangeOrderRevisions,
  useCompareRevisions,
  CORevision,
} from '@/hooks/useChangeOrders';
import { formatCurrency, formatDate } from '@/types/financial';
import {
  History,
  GitCompare,
  Calendar,
  User,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CORevisionHistoryProps {
  changeOrderId: string;
  currentRevision: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Field display names
const fieldLabels: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  reason: 'Reason',
  amount: 'Amount',
  base_amount: 'Base Amount',
  gc_fee_percent: 'GC Fee %',
  gc_fee_amount: 'GC Fee Amount',
  admin_hours: 'Admin Hours',
  admin_rate: 'Admin Rate',
  admin_cost: 'Admin Cost',
  days_added: 'Days Added',
  markup_percent: 'Markup %',
  markup_amount: 'Markup Amount',
  subtotal: 'Subtotal',
  total_amount: 'Total Amount',
  pm_hours: 'PM Hours',
  pm_hourly_rate: 'PM Hourly Rate',
  pm_cost: 'PM Cost',
  days_impact: 'Days Impact',
  line_items_count: 'Line Items',
};

// Format field values based on type
function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return '—';

  if (field.includes('amount') || field.includes('cost') || field.includes('rate') || field === 'subtotal') {
    return formatCurrency(value);
  }
  if (field.includes('percent')) {
    return `${value}%`;
  }
  if (field.includes('hours')) {
    return `${value} hrs`;
  }
  if (field.includes('days') || field === 'days_impact') {
    return `${value} days`;
  }
  return String(value);
}

// Get change indicator
function ChangeIndicator({ from, to, field }: { from: any; to: any; field: string }) {
  const isNumeric = typeof from === 'number' && typeof to === 'number';

  if (!isNumeric) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }

  if (to > from) {
    return <ArrowUp className="h-4 w-4 text-green-600" />;
  } else if (to < from) {
    return <ArrowDown className="h-4 w-4 text-red-600" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function CORevisionHistory({
  changeOrderId,
  currentRevision,
  open,
  onOpenChange,
}: CORevisionHistoryProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedRev1, setSelectedRev1] = useState<number | null>(null);
  const [selectedRev2, setSelectedRev2] = useState<number | null>(null);

  const { data: revisions, isLoading } = useChangeOrderRevisions(changeOrderId);
  const { data: comparison, isLoading: isComparing } = useCompareRevisions(
    changeOrderId,
    selectedRev1 ?? -1,
    selectedRev2 ?? -1
  );

  const handleStartCompare = () => {
    setCompareMode(true);
    if (revisions && revisions.length >= 2) {
      setSelectedRev1(revisions[1]?.revision_number ?? 0);
      setSelectedRev2(revisions[0]?.revision_number ?? 0);
    }
  };

  const handleExitCompare = () => {
    setCompareMode(false);
    setSelectedRev1(null);
    setSelectedRev2(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <DialogTitle>Revision History</DialogTitle>
              <Badge variant="outline">
                Current: Rev {currentRevision}
              </Badge>
            </div>
            {!compareMode && revisions && revisions.length >= 2 && (
              <Button variant="outline" size="sm" onClick={handleStartCompare}>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Revisions
              </Button>
            )}
            {compareMode && (
              <Button variant="ghost" size="sm" onClick={handleExitCompare}>
                Exit Compare
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : compareMode ? (
            // Compare Mode
            <div className="space-y-4">
              {/* Revision selectors */}
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">From Revision</label>
                  <Select
                    value={selectedRev1?.toString()}
                    onValueChange={(v) => setSelectedRev1(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisions?.map((rev) => (
                        <SelectItem
                          key={rev.revision_number}
                          value={rev.revision_number.toString()}
                          disabled={rev.revision_number === selectedRev2}
                        >
                          Rev {rev.revision_number} - {formatDate(rev.created_at)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">To Revision</label>
                  <Select
                    value={selectedRev2?.toString()}
                    onValueChange={(v) => setSelectedRev2(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisions?.map((rev) => (
                        <SelectItem
                          key={rev.revision_number}
                          value={rev.revision_number.toString()}
                          disabled={rev.revision_number === selectedRev1}
                        >
                          Rev {rev.revision_number} - {formatDate(rev.created_at)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comparison results */}
              {isComparing ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : comparison ? (
                <div className="space-y-4">
                  {comparison.changes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No differences between these revisions
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground">
                        {comparison.changes.length} field(s) changed
                      </div>
                      <div className="border rounded-lg divide-y">
                        {comparison.changes.map((change) => (
                          <div
                            key={change.field}
                            className="p-4 grid grid-cols-[1fr,auto,1fr] gap-4 items-center"
                          >
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">
                                Rev {selectedRev1}
                              </p>
                              <p className={cn(
                                "font-medium",
                                typeof change.from === 'number' && change.from > change.to
                                  ? "text-green-600"
                                  : ""
                              )}>
                                {formatValue(change.field, change.from)}
                              </p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {fieldLabels[change.field] || change.field}
                              </span>
                              <ChangeIndicator
                                from={change.from}
                                to={change.to}
                                field={change.field}
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Rev {selectedRev2}
                              </p>
                              <p className={cn(
                                "font-medium",
                                typeof change.to === 'number' && change.to > change.from
                                  ? "text-green-600"
                                  : typeof change.to === 'number' && change.to < change.from
                                    ? "text-red-600"
                                    : ""
                              )}>
                                {formatValue(change.field, change.to)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select two revisions to compare
                </div>
              )}
            </div>
          ) : (
            // Timeline Mode
            <div className="space-y-1">
              {/* Current state indicator */}
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-primary/5 border-primary/20">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <div className="w-0.5 h-full bg-border" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground">
                        Current (Rev {currentRevision})
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Active working version
                  </p>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Revision history */}
              {revisions && revisions.length > 0 ? (
                revisions.map((revision, index) => (
                  <div
                    key={revision.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                      {index < revisions.length - 1 && (
                        <div className="w-0.5 h-full bg-border min-h-[40px]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Rev {revision.revision_number}</Badge>
                          <span className="text-sm font-medium">
                            {formatCurrency(revision.total_amount || 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(revision.created_at)}
                          </span>
                          {revision.revised_by && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {revision.revised_by}
                            </span>
                          )}
                        </div>
                      </div>
                      {revision.revision_reason && (
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                          {revision.revision_reason}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {revision.line_items && (
                          <Badge variant="secondary" className="text-xs">
                            {revision.line_items.length} line items
                          </Badge>
                        )}
                        {revision.markup_percent !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {revision.markup_percent}% markup
                          </Badge>
                        )}
                        {revision.days_impact !== undefined && revision.days_impact !== 0 && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              revision.days_impact > 0 ? "border-amber-500" : "border-green-500"
                            )}
                          >
                            {revision.days_impact > 0 ? '+' : ''}{revision.days_impact} days
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No revision history yet</p>
                  <p className="text-xs mt-1">
                    Revisions are created when changes are made to approved change orders
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
