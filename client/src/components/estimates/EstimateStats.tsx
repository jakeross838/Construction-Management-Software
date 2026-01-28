import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Clock, 
  Send, 
  CheckCircle2, 
  DollarSign,
  TrendingUp 
} from 'lucide-react';
import { Estimate, formatCurrencyCompact } from '@/types/estimate';

interface EstimateStatsProps {
  estimates: Estimate[];
}

export function EstimateStats({ estimates }: EstimateStatsProps) {
  const stats = {
    total: estimates.length,
    drafts: estimates.filter(e => e.status === 'draft' || e.status === 'pending_review').length,
    sent: estimates.filter(e => e.status === 'sent').length,
    approved: estimates.filter(e => e.status === 'approved' || e.status === 'converted').length,
    pipelineValue: estimates
      .filter(e => e.status === 'sent')
      .reduce((sum, e) => sum + e.totalAmount, 0),
    winRate: estimates.length > 0 
      ? Math.round((estimates.filter(e => e.status === 'approved' || e.status === 'converted').length / 
          estimates.filter(e => ['approved', 'converted', 'declined', 'expired'].includes(e.status)).length) * 100) || 0
      : 0,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Estimates</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-semibold">{stats.drafts}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Awaiting Response</p>
              <p className="text-2xl font-semibold">{stats.sent}</p>
            </div>
            <Send className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Won</p>
              <p className="text-2xl font-semibold">{stats.approved}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pipeline Value</p>
              <p className="text-2xl font-semibold">{formatCurrencyCompact(stats.pipelineValue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-emerald-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-indigo-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-semibold">{stats.winRate}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-indigo-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
