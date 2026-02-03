import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, DollarSign, Award } from 'lucide-react';
import { Lead } from '@/hooks/useDBLeads';
import { formatCurrency } from '@/data/mockData';

interface SourceAnalyticsCardProps {
  leads: Lead[];
}

interface SourceStat {
  name: string;
  category: string | null;
  count: number;
  value: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
}

export function SourceAnalyticsCard({ leads }: SourceAnalyticsCardProps) {
  const analytics = useMemo(() => {
    // Group leads by source
    const sourceMap = new Map<string, SourceStat>();

    leads.forEach(lead => {
      const sourceName = lead.source?.name || 'Unknown';
      const sourceCategory = lead.source?.category || null;

      if (!sourceMap.has(sourceName)) {
        sourceMap.set(sourceName, {
          name: sourceName,
          category: sourceCategory,
          count: 0,
          value: 0,
          wonCount: 0,
          lostCount: 0,
          conversionRate: 0,
        });
      }

      const stat = sourceMap.get(sourceName)!;
      stat.count++;
      stat.value += lead.estimated_value || 0;

      if (lead.stage === 'won') stat.wonCount++;
      if (lead.stage === 'lost') stat.lostCount++;
    });

    // Calculate conversion rates
    const sources = Array.from(sourceMap.values()).map(source => {
      const closedCount = source.wonCount + source.lostCount;
      source.conversionRate = closedCount > 0
        ? Math.round((source.wonCount / closedCount) * 100)
        : 0;
      return source;
    });

    // Sort by count (most leads first)
    sources.sort((a, b) => b.count - a.count);

    // Find best performing source (by conversion rate with min 2 closed)
    const qualifiedSources = sources.filter(s => (s.wonCount + s.lostCount) >= 2);
    const bestSource = qualifiedSources.length > 0
      ? qualifiedSources.reduce((best, source) =>
          source.conversionRate > best.conversionRate ? source : best
        , qualifiedSources[0])
      : null;

    // Total value by source category
    const categoryTotals = new Map<string, { count: number; value: number }>();
    sources.forEach(source => {
      const cat = source.category || 'other';
      if (!categoryTotals.has(cat)) {
        categoryTotals.set(cat, { count: 0, value: 0 });
      }
      const catStat = categoryTotals.get(cat)!;
      catStat.count += source.count;
      catStat.value += source.value;
    });

    const maxCount = Math.max(...sources.map(s => s.count), 1);

    return {
      sources: sources.slice(0, 8), // Top 8 sources
      bestSource,
      categoryTotals: Array.from(categoryTotals.entries())
        .sort((a, b) => b[1].count - a[1].count),
      maxCount,
    };
  }, [leads]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      referral: 'bg-green-100 text-green-700',
      online: 'bg-blue-100 text-blue-700',
      direct: 'bg-purple-100 text-purple-700',
      events: 'bg-amber-100 text-amber-700',
      advertising: 'bg-pink-100 text-pink-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[category] || colors.other;
  };

  if (analytics.sources.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lead Source Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lead source data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Lead Source Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Best Performing Source */}
        {analytics.bestSource && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Top Performing Source</span>
            </div>
            <p className="text-lg font-bold text-green-700">{analytics.bestSource.name}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-green-600">
              <span>{analytics.bestSource.conversionRate}% win rate</span>
              <span>{analytics.bestSource.count} leads</span>
              <span>{formatCurrency(analytics.bestSource.value)} value</span>
            </div>
          </div>
        )}

        {/* Category Summary */}
        {analytics.categoryTotals.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By Category</h4>
            <div className="flex flex-wrap gap-2">
              {analytics.categoryTotals.map(([category, stats]) => (
                <Badge key={category} className={getCategoryColor(category)}>
                  {category}: {stats.count} leads
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">All Sources</h4>
          <div className="space-y-2">
            {analytics.sources.map(source => {
              const widthPercent = (source.count / analytics.maxCount) * 100;
              return (
                <div key={source.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{source.name}</span>
                      {source.category && (
                        <Badge variant="outline" className="text-xs">
                          {source.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{source.count}</span>
                      {(source.wonCount + source.lostCount) > 0 && (
                        <span className="text-xs">
                          {source.conversionRate}% win
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={widthPercent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
