import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Clock, Target, ArrowRight } from 'lucide-react';
import { Lead, PipelineStage } from '@/hooks/useDBLeads';
import { formatCurrency } from '@/data/mockData';

interface PipelineAnalyticsCardProps {
  leads: Lead[];
  stages: PipelineStage[];
}

export function PipelineAnalyticsCard({ leads, stages }: PipelineAnalyticsCardProps) {
  const analytics = useMemo(() => {
    // Filter active stages (not won/lost)
    const activeStages = stages
      .filter(s => !s.is_won_stage && !s.is_lost_stage)
      .sort((a, b) => a.stage_order - b.stage_order);

    // Count leads by stage
    const stageCounts: Record<string, { count: number; value: number }> = {};
    leads.forEach(lead => {
      if (!stageCounts[lead.stage]) {
        stageCounts[lead.stage] = { count: 0, value: 0 };
      }
      stageCounts[lead.stage].count++;
      stageCounts[lead.stage].value += lead.estimated_value || 0;
    });

    // Calculate conversion metrics
    const wonLeads = leads.filter(l => l.stage === 'won');
    const lostLeads = leads.filter(l => l.stage === 'lost');
    const closedLeads = wonLeads.length + lostLeads.length;
    const conversionRate = closedLeads > 0
      ? (wonLeads.length / closedLeads * 100).toFixed(1)
      : '0.0';

    // Calculate avg days in pipeline for won leads
    const avgDaysToWon = wonLeads.length > 0
      ? Math.round(wonLeads.reduce((sum, lead) => {
          const created = new Date(lead.created_at);
          const entered = lead.stage_entered_at ? new Date(lead.stage_entered_at) : new Date();
          return sum + Math.floor((entered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / wonLeads.length)
      : 0;

    // Total pipeline value (active leads)
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.stage));
    const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

    // Create funnel data
    const funnelData = activeStages.map(stage => {
      const stageData = stageCounts[stage.slug] || { count: 0, value: 0 };
      return {
        ...stage,
        count: stageData.count,
        value: stageData.value,
      };
    });

    // Find max count for funnel visualization
    const maxCount = Math.max(...funnelData.map(s => s.count), 1);

    return {
      conversionRate,
      avgDaysToWon,
      pipelineValue,
      totalLeads: leads.length,
      activeLeads: activeLeads.length,
      wonLeads: wonLeads.length,
      lostLeads: lostLeads.length,
      funnelData,
      maxCount,
    };
  }, [leads, stages]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Pipeline Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-2xl font-bold text-green-600">{analytics.conversionRate}%</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Days to Win</p>
            <p className="text-2xl font-bold text-blue-600">{analytics.avgDaysToWon}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(analytics.pipelineValue)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Active / Total</p>
            <p className="text-2xl font-bold">{analytics.activeLeads}/{analytics.totalLeads}</p>
          </div>
        </div>

        {/* Win/Loss Summary */}
        <div className="flex items-center gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm">Won: {analytics.wonLeads}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm">Lost: {analytics.lostLeads}</span>
          </div>
        </div>

        {/* Pipeline Funnel */}
        {analytics.funnelData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Stage Funnel
            </h4>
            <div className="space-y-2">
              {analytics.funnelData.map((stage, index) => {
                const widthPercent = (stage.count / analytics.maxCount) * 100;
                return (
                  <div key={stage.id} className="flex items-center gap-2">
                    <div className="w-32 text-xs truncate" title={stage.name}>
                      {stage.name}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(widthPercent, stage.count > 0 ? 10 : 0)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                      {stage.count > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                          {stage.count}
                        </span>
                      )}
                    </div>
                    <div className="w-20 text-xs text-right text-muted-foreground">
                      {formatCurrency(stage.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
