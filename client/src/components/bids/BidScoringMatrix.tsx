import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ClipboardCheck,
  Star,
  Save,
  Loader2,
  Trophy,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/types/financial';
import { cn } from '@/lib/utils';

interface ScoringCriterion {
  id: string;
  name: string;
  description?: string;
  weight: number;
  max_score: number;
}

interface BidSubmission {
  id: string;
  vendor_name: string;
  bid_amount: number;
  evaluation_score?: number | null;
  is_lowest_bid?: boolean;
}

interface EvaluationScore {
  criteria_id: string;
  score: number;
  notes?: string;
}

interface BidScoringMatrixProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidPackageId: string;
  criteria: ScoringCriterion[];
  submissions: BidSubmission[];
  existingScores?: Record<string, EvaluationScore[]>;  // keyed by submission_id
  onSave: (submissionId: string, scores: EvaluationScore[]) => Promise<void>;
  isSaving?: boolean;
}

// Star rating component
function StarRating({
  value,
  maxValue,
  onChange,
  disabled,
}: {
  value: number;
  maxValue: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxValue }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "p-0.5 transition-colors",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
          )}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300 hover:text-amber-200"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function BidScoringMatrix({
  open,
  onOpenChange,
  bidPackageId,
  criteria,
  submissions,
  existingScores = {},
  onSave,
  isSaving,
}: BidScoringMatrixProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(
    submissions[0]?.id || null
  );
  const [scores, setScores] = useState<Record<string, EvaluationScore[]>>(existingScores);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize scores for new submission
  const getSubmissionScores = (submissionId: string): EvaluationScore[] => {
    if (scores[submissionId]) return scores[submissionId];
    return criteria.map(c => ({ criteria_id: c.id, score: 0 }));
  };

  // Calculate weighted score for a submission
  const calculateWeightedScore = (submissionId: string): number | null => {
    const subScores = scores[submissionId] || [];
    if (subScores.length === 0) return null;

    let totalWeighted = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const evalScore = subScores.find(s => s.criteria_id === criterion.id);
      if (evalScore && evalScore.score > 0) {
        const normalized = evalScore.score / criterion.max_score;
        totalWeighted += normalized * criterion.weight;
        totalWeight += criterion.weight;
      }
    }

    if (totalWeight === 0) return null;
    return Math.round((totalWeighted / totalWeight) * 100);
  };

  // Update a score
  const updateScore = (criteriaId: string, score: number, notes?: string) => {
    setHasChanges(true);
    setScores(prev => {
      const submissionId = selectedSubmission!;
      const current = prev[submissionId] || [];
      const existing = current.findIndex(s => s.criteria_id === criteriaId);

      let updated: EvaluationScore[];
      if (existing >= 0) {
        updated = [...current];
        updated[existing] = { ...updated[existing], score, notes: notes ?? updated[existing].notes };
      } else {
        updated = [...current, { criteria_id: criteriaId, score, notes }];
      }

      return { ...prev, [submissionId]: updated };
    });
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedSubmission) return;
    await onSave(selectedSubmission, scores[selectedSubmission] || []);
    setHasChanges(false);
  };

  // Get sorted submissions by score
  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      const scoreA = calculateWeightedScore(a.id) ?? -1;
      const scoreB = calculateWeightedScore(b.id) ?? -1;
      return scoreB - scoreA;
    });
  }, [submissions, scores]);

  // Find best submission
  const bestSubmission = sortedSubmissions.find(s => calculateWeightedScore(s.id) !== null);

  const selectedBid = submissions.find(s => s.id === selectedSubmission);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Bid Evaluation Matrix
          </DialogTitle>
          <DialogDescription>
            Score each submission against the evaluation criteria to determine the best value.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Submissions Sidebar */}
          <div className="w-64 border-r pr-4 flex flex-col">
            <Label className="mb-2 text-sm font-medium">Submissions</Label>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {sortedSubmissions.map((sub, idx) => {
                  const score = calculateWeightedScore(sub.id);
                  const isBest = bestSubmission?.id === sub.id && score !== null;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub.id)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedSubmission === sub.id
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted/50",
                        isBest && "ring-2 ring-amber-400"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isBest && <Trophy className="h-4 w-4 text-amber-500" />}
                        <span className="font-medium text-sm truncate">
                          {sub.vendor_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(sub.bid_amount)}
                        </span>
                        {score !== null && (
                          <Badge
                            variant="outline"
                            className={cn(
                              score >= 80 ? "text-green-600 border-green-200" :
                              score >= 60 ? "text-blue-600 border-blue-200" :
                              "text-amber-600 border-amber-200"
                            )}
                          >
                            {score}%
                          </Badge>
                        )}
                      </div>
                      {sub.is_lowest_bid && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Lowest Bid
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Scoring Form */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedBid ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{selectedBid.vendor_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Bid Amount: {formatCurrency(selectedBid.bid_amount)}
                    </p>
                  </div>
                  {calculateWeightedScore(selectedSubmission!) !== null && (
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {calculateWeightedScore(selectedSubmission!)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Weighted Score</p>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {criteria.map(criterion => {
                      const currentScores = getSubmissionScores(selectedSubmission!);
                      const evalScore = currentScores.find(s => s.criteria_id === criterion.id);
                      const score = evalScore?.score || 0;

                      return (
                        <div
                          key={criterion.id}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{criterion.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {criterion.weight}%
                                </Badge>
                                {criterion.description && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {criterion.description}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              {criterion.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {criterion.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <StarRating
                                value={score}
                                maxValue={criterion.max_score}
                                onChange={(v) => updateScore(criterion.id, v)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {score} / {criterion.max_score}
                              </span>
                            </div>
                          </div>
                          {/* Progress bar showing contribution */}
                          <div className="mt-3">
                            <Progress
                              value={(score / criterion.max_score) * 100}
                              className="h-1.5"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a submission to evaluate
              </div>
            )}
          </div>
        </div>

        {/* Summary Table */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-sm font-medium mb-2 block">Score Comparison</Label>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Bid Amount</TableHead>
                  {criteria.map(c => (
                    <TableHead key={c.id} className="text-center w-16">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-xs">
                            {c.name.slice(0, 8)}...
                          </TooltipTrigger>
                          <TooltipContent>{c.name} ({c.weight}%)</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubmissions.map((sub, idx) => {
                  const subScores = scores[sub.id] || [];
                  const totalScore = calculateWeightedScore(sub.id);

                  return (
                    <TableRow
                      key={sub.id}
                      className={cn(
                        idx === 0 && totalScore !== null && "bg-amber-50"
                      )}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {idx === 0 && totalScore !== null && (
                            <Trophy className="h-4 w-4 text-amber-500" />
                          )}
                          {sub.vendor_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(sub.bid_amount)}
                      </TableCell>
                      {criteria.map(c => {
                        const evalScore = subScores.find(s => s.criteria_id === c.id);
                        return (
                          <TableCell key={c.id} className="text-center">
                            {evalScore?.score ?? '—'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold">
                        {totalScore !== null ? `${totalScore}%` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-amber-600 mr-auto">
              <AlertTriangle className="h-4 w-4" />
              Unsaved changes
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Evaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
