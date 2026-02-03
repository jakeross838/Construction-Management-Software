import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { useLostLeadAnalytics } from '@/hooks/useDBLeads';
import { formatCurrency } from '@/data/mockData';

export function LostAnalyticsCard() {
  const { data: analytics, isLoading, error } = useLostLeadAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Lost Lead Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return null;
  }

  if (analytics.total_lost === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Lost Lead Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lost leads to analyze</p>
            <p className="text-xs mt-1">Great job keeping leads in the pipeline!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Lost Lead Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total Lost</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{analytics.total_lost}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Lost Value</span>
            </div>
            <p className="text-2xl font-bold text-red-700">
              {formatCurrency(analytics.total_lost_value)}
            </p>
          </div>
        </div>

        {/* By Reason */}
        {analytics.by_reason.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">By Reason</h4>
            <div className="space-y-2">
              {analytics.by_reason.slice(0, 5).map((item) => (
                <div key={item.reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{item.reason}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.count}
                      </Badge>
                      <span className="text-muted-foreground text-xs w-10 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <Progress value={item.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Competitor */}
        {analytics.by_competitor.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Top Competitors</h4>
            <div className="space-y-2">
              {analytics.by_competitor.slice(0, 5).map((item) => (
                <div key={item.competitor} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span className="truncate font-medium">{item.competitor}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.count} lead{item.count !== 1 ? 's' : ''}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
