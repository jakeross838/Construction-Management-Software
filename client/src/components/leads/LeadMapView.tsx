import { useMemo, useState, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Mail, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { Lead, PipelineStage } from '@/hooks/useDBLeads';
import { formatCurrency } from '@/data/mockData';

// Stage colors for markers
const stageColors: Record<string, string> = {
  new_inquiry: '#94a3b8',
  initial_contact: '#60a5fa',
  scope_discussion: '#818cf8',
  team_assembly: '#a78bfa',
  precon_agreement: '#c084fc',
  design_engineering: '#e879f9',
  prelim_estimate: '#f472b6',
  budget_review: '#fb7185',
  final_estimate: '#f97316',
  contract_negotiation: '#facc15',
  won: '#22c55e',
  lost: '#ef4444',
};

interface LeadMapViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  onViewLead?: (lead: Lead) => void;
}

export function LeadMapView({ leads, stages, onViewLead }: LeadMapViewProps) {
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [showNoLocation, setShowNoLocation] = useState(false);

  // Filter leads by stage
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
      return true;
    });
  }, [leads, stageFilter]);

  // Leads with valid coordinates
  const mappableLeads = useMemo(() => {
    return filteredLeads.filter(lead => lead.lot_lat && lead.lot_lng);
  }, [filteredLeads]);

  // Leads without coordinates
  const unmappableLeads = useMemo(() => {
    return filteredLeads.filter(lead => !lead.lot_lat || !lead.lot_lng);
  }, [filteredLeads]);

  // Get stage info
  const getStageInfo = (slug: string) => {
    return stages.find(s => s.slug === slug);
  };

  // Get marker color
  const getMarkerColor = (stage: string) => {
    return stageColors[stage] || '#6b7280';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Stage:</span>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map(stage => (
                <SelectItem key={stage.id} value={stage.slug}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{mappableLeads.length} leads on map</span>
          {unmappableLeads.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {unmappableLeads.length} without location
            </Badge>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="h-[500px] rounded-lg border overflow-hidden bg-muted/20">
        {mappableLeads.length > 0 ? (
          <div className="h-full w-full relative">
            {/* Simple map placeholder with lead markers */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex justify-center gap-2 flex-wrap">
                  {mappableLeads.map(lead => {
                    const stageInfo = getStageInfo(lead.stage);
                    return (
                      <div
                        key={lead.id}
                        className="bg-white rounded-lg shadow-md p-3 cursor-pointer hover:shadow-lg transition-shadow max-w-[200px]"
                        onClick={() => onViewLead?.(lead)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: getMarkerColor(lead.stage) }}
                          />
                          <span className="font-medium text-sm truncate">
                            {lead.first_name} {lead.last_name}
                          </span>
                        </div>
                        {lead.project_address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.project_address}
                          </p>
                        )}
                        {lead.estimated_value && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            {formatCurrency(lead.estimated_value)}
                          </p>
                        )}
                        {stageInfo && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-xs"
                            style={{ borderColor: stageInfo.color }}
                          >
                            {stageInfo.name}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {mappableLeads.length} lead{mappableLeads.length !== 1 ? 's' : ''} with location data
                </p>
                <p className="text-xs text-muted-foreground">
                  Coordinates: Lat {mappableLeads[0]?.lot_lat?.toFixed(4)}, Lng {mappableLeads[0]?.lot_lng?.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No leads with location data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add coordinates to leads to see them on the map
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Leads without location */}
      {unmappableLeads.length > 0 && showNoLocation && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Leads Without Location ({unmappableLeads.length})
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unmappableLeads.map(lead => (
                <div
                  key={lead.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onViewLead?.(lead)}
                >
                  <p className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lead.project_address || 'No address'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unmappableLeads.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNoLocation(!showNoLocation)}
        >
          {showNoLocation ? 'Hide' : 'Show'} leads without location
        </Button>
      )}
    </div>
  );
}
