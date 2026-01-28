import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/types/financial';
import { FileText, Clock, CheckCircle, Briefcase } from 'lucide-react';
import type { Draw } from '@/types/financial';

interface DrawStatsProps {
  draws: Draw[];
}

export function DrawStats({ draws }: DrawStatsProps) {
  const stats = {
    drafts: draws.filter(d => d.status === 'draft').length,
    draftAmount: draws.filter(d => d.status === 'draft').reduce((sum, d) => sum + (d.current_payment_due || 0), 0),
    submitted: draws.filter(d => d.status === 'submitted').length,
    submittedAmount: draws.filter(d => d.status === 'submitted').reduce((sum, d) => sum + (d.current_payment_due || 0), 0),
    fundedAmount: draws.filter(d => d.status === 'funded').reduce((sum, d) => sum + (d.funded_amount || 0), 0),
    totalRequested: draws.reduce((sum, d) => sum + (d.current_payment_due || 0), 0),
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Draft</p>
              <p className="text-2xl font-semibold">{stats.drafts}</p>
            </div>
            <FileText className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats.draftAmount)}</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="text-2xl font-semibold">{stats.submitted}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats.submittedAmount)}</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Funded</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.fundedAmount)}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Received</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Requested</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.totalRequested)}</p>
            </div>
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{draws.length} draws</p>
        </CardContent>
      </Card>
    </div>
  );
}
