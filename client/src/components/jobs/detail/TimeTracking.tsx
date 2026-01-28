import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TimeEntry } from '@/types/job';
import { formatCurrencyFull } from '@/types/job';

interface TimeTrackingProps {
  entries: TimeEntry[];
  totalHours: number;
  estimatedHours: number;
}

export function TimeTracking({ entries, totalHours, estimatedHours }: TimeTrackingProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  // Calculate totals
  const recentHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const recentLaborCost = entries.reduce((sum, e) => sum + (e.hours * e.hourlyRate), 0);
  const recentBurdenCost = entries.reduce((sum, e) => sum + (e.hours * e.burdenRate), 0);
  const totalCost = recentLaborCost + recentBurdenCost;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-secondary/50 p-2">
              <Clock className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Time & Labor Tracking</h3>
              <p className="text-sm text-muted-foreground">
                {totalHours.toLocaleString()} / {estimatedHours.toLocaleString()} hours logged
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Log Time
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Recent Hours</p>
              <p className="text-lg font-bold font-mono">{recentHours}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Labor Cost</p>
              <p className="text-lg font-bold font-mono">{formatCurrencyFull(recentLaborCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Burden Cost</p>
              <p className="text-lg font-bold font-mono text-warning">{formatCurrencyFull(recentBurdenCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cost</p>
              <p className="text-lg font-bold font-mono">{formatCurrencyFull(totalCost)}</p>
            </div>
          </div>

          {/* Time Entries by Date */}
          <div className="divide-y divide-border">
            {sortedDates.map((date) => {
              const dateEntries = groupedEntries[date];
              const dayHours = dateEntries.reduce((sum, e) => sum + e.hours, 0);
              const formatted = new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              });

              return (
                <div key={date}>
                  <div className="px-6 py-2 bg-muted/20 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatted}</span>
                    <Badge variant="outline" className="ml-auto">{dayHours} hrs</Badge>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Cost Code</th>
                        <th>Description</th>
                        <th className="text-right">Hours</th>
                        <th className="text-right">Rate</th>
                        <th className="text-right">Burden</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateEntries.map((entry) => {
                        const entryTotal = entry.hours * (entry.hourlyRate + entry.burdenRate);
                        return (
                          <tr key={entry.id}>
                            <td className="font-medium">{entry.employeeName}</td>
                            <td>
                              <Badge variant="outline" className="font-mono text-xs">
                                {entry.costCode}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground">{entry.description}</td>
                            <td className="text-right font-mono">{entry.hours}</td>
                            <td className="text-right font-mono">${entry.hourlyRate.toFixed(2)}</td>
                            <td className="text-right font-mono text-warning">${entry.burdenRate.toFixed(2)}</td>
                            <td className="text-right font-mono font-medium">{formatCurrencyFull(entryTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {entries.length === 0 && (
            <div className="px-6 py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No time entries yet</p>
              <Button variant="outline" size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-1" />
                Log First Entry
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
