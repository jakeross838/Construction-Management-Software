import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, drawStatusConfig } from '@/types/financial';
import type { Draw } from '@/types/financial';
import { cn } from '@/lib/utils';

interface DrawTableProps {
  draws: Draw[];
  selectedDrawId: string | null;
  onSelectDraw: (draw: Draw) => void;
}

export function DrawTable({ draws, selectedDrawId, onSelectDraw }: DrawTableProps) {
  if (draws.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No draws found matching your filters
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Draw #</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Period End</TableHead>
            <TableHead className="text-right">Payment Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Funded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draws.map((draw) => {
            const config = drawStatusConfig[draw.status];
            const isSelected = draw.id === selectedDrawId;
            
            return (
              <TableRow
                key={draw.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                )}
                onClick={() => onSelectDraw(draw)}
              >
                <TableCell className="font-medium">Draw #{draw.draw_number}</TableCell>
                <TableCell className="text-muted-foreground">{draw.job?.name || draw.job_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {draw.period_end ? formatDate(draw.period_end) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(draw.total_amount || 0)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={cn("border", config?.color)}
                  >
                    {config?.label || draw.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {draw.funded_at ? (
                    <span className="text-green-600 font-medium">
                      {formatCurrency(draw.funded_amount || 0)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
