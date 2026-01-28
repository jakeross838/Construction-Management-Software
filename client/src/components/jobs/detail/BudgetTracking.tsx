import { useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CostCategory, ChangeOrder } from '@/types/job';
import { formatCurrency, formatCurrencyFull } from '@/types/job';

interface BudgetTrackingProps {
  costs: CostCategory[];
  changeOrders: ChangeOrder[];
}

export function BudgetTracking({ costs, changeOrders }: BudgetTrackingProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalBudgeted = costs.reduce((sum, c) => sum + c.budgeted, 0);
  const totalActual = costs.reduce((sum, c) => sum + c.actual, 0);
  const totalCommitted = costs.reduce((sum, c) => sum + c.committed, 0);
  const approvedCOs = changeOrders.filter(co => co.status === 'approved');
  const pendingCOs = changeOrders.filter(co => co.status === 'pending');
  const coTotal = approvedCOs.reduce((sum, co) => sum + co.amount, 0);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Budget & Cost Tracking</h3>
              <p className="text-sm text-muted-foreground">Detailed cost breakdown by category</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Cost
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-muted/30 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Original Budget</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalBudgeted)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Actual Costs</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalActual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Committed</p>
              <p className="text-lg font-bold font-mono text-warning">{formatCurrency(totalCommitted)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Approved COs</p>
              <p className="text-lg font-bold font-mono text-profit">+{formatCurrency(coTotal)}</p>
            </div>
          </div>

          {/* Cost Categories Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Budgeted</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Committed</th>
                  <th className="text-right">Variance</th>
                  <th className="w-32">Progress</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((cost) => {
                  const variance = cost.budgeted - cost.actual - cost.committed;
                  const progress = ((cost.actual + cost.committed) / cost.budgeted) * 100;
                  
                  return (
                    <tr key={cost.id}>
                      <td className="font-medium">{cost.name}</td>
                      <td className="text-right font-mono">{formatCurrencyFull(cost.budgeted)}</td>
                      <td className="text-right font-mono">{formatCurrencyFull(cost.actual)}</td>
                      <td className="text-right font-mono text-warning">
                        {cost.committed > 0 ? formatCurrencyFull(cost.committed) : '—'}
                      </td>
                      <td className={cn(
                        "text-right font-mono font-medium",
                        variance >= 0 ? "text-profit" : "text-loss"
                      )}>
                        {variance >= 0 ? '+' : ''}{formatCurrencyFull(variance)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.min(progress, 100)} 
                            className={cn("h-1.5", progress > 100 && "[&>div]:bg-loss")}
                          />
                          <span className="text-xs text-muted-foreground font-mono w-10">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Change Orders */}
          {changeOrders.length > 0 && (
            <div className="border-t border-border">
              <div className="px-6 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Change Orders</span>
                  {pendingCOs.length > 0 && (
                    <Badge variant="outline" className="text-warning border-warning">
                      {pendingCOs.length} pending
                    </Badge>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border">
                {changeOrders.map((co) => (
                  <div key={co.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{co.number}</span>
                        <Badge 
                          variant={co.status === 'approved' ? 'default' : co.status === 'pending' ? 'outline' : 'destructive'}
                          className={cn(
                            co.status === 'approved' && 'bg-profit hover:bg-profit/90',
                            co.status === 'pending' && 'border-warning text-warning'
                          )}
                        >
                          {co.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{co.description}</p>
                    </div>
                    <span className={cn(
                      "font-mono font-semibold",
                      co.status === 'approved' ? "text-profit" : "text-muted-foreground"
                    )}>
                      +{formatCurrency(co.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
