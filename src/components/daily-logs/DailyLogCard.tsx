import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Wind,
  CloudLightning,
  Users,
  Truck,
  ClipboardCheck,
  Image,
  Clock,
  Thermometer,
  Edit,
  Trash2,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HardHat,
  Phone,
  PhoneOff,
  MapPin,
  X,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  DailyLog, 
  WeatherCondition, 
  AbsentReason,
  constructionPhases,
  absentReasonOptions,
  useCompleteDailyLog,
  useReopenDailyLog,
  useDeleteDailyLog,
} from '@/hooks/useDailyLogs';
import { useVendors } from '@/hooks/useVendors';

interface DailyLogCardProps {
  log: DailyLog;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

const getWeatherIcon = (condition: WeatherCondition | null, size = 'h-5 w-5') => {
  switch (condition) {
    case 'sunny': return <Sun className={`${size} text-amber-500`} />;
    case 'partly_cloudy': return <Cloud className={`${size} text-blue-400`} />;
    case 'cloudy': return <Cloud className={`${size} text-gray-500`} />;
    case 'rainy': return <CloudRain className={`${size} text-blue-600`} />;
    case 'stormy': return <CloudLightning className={`${size} text-purple-600`} />;
    case 'windy': return <Wind className={`${size} text-teal-500`} />;
    case 'snow': return <Snowflake className={`${size} text-cyan-400`} />;
    default: return null;
  }
};

const getWeatherLabel = (condition: WeatherCondition | null) => {
  const labels: Record<WeatherCondition, string> = {
    sunny: 'Sunny',
    partly_cloudy: 'Partly Cloudy',
    cloudy: 'Cloudy',
    rainy: 'Rainy',
    stormy: 'Stormy',
    windy: 'Windy',
    snow: 'Snow',
  };
  return condition ? labels[condition] : '';
};

const getReasonLabel = (reason: AbsentReason) => {
  const opt = absentReasonOptions.find(o => o.value === reason);
  return opt?.label || reason;
};

const getResultBadge = (result: string) => {
  switch (result) {
    case 'passed':
      return <Badge variant="outline" className="text-xs border-success text-success">✅ Passed</Badge>;
    case 'failed':
      return <Badge variant="outline" className="text-xs border-destructive text-destructive">❌ Failed</Badge>;
    case 'partial':
      return <Badge variant="outline" className="text-xs border-warning text-warning">⚠️ Partial</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">📅 Scheduled</Badge>;
  }
};

export function DailyLogCard({ log, onClick, onEdit, onDuplicate }: DailyLogCardProps) {
  const { data: vendors = [] } = useVendors();
  const completeLog = useCompleteDailyLog();
  const reopenLog = useReopenDailyLog();
  const deleteLog = useDeleteDailyLog();
  const [expanded, setExpanded] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate();
  };

  const isDraft = log.status === 'draft';
  const phaseLabel = constructionPhases.find(p => p.value === log.construction_phase)?.label;
  
  const totalWorkers = (log.crew || []).reduce((sum, c) => sum + c.worker_count, 0);
  const totalHours = (log.crew || []).reduce((sum, c) => sum + (c.worker_count * (c.hours_worked || 0)), 0);
  const deliveryCount = log.deliveries?.length || 0;
  const inspectionCount = log.inspections?.length || 0;
  const photoCount = log.attachments?.length || 0;
  const photos = log.attachments || [];

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await completeLog.mutateAsync(log.id);
  };

  const handleReopen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await reopenLog.mutateAsync(log.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this daily log?')) {
      await deleteLog.mutateAsync(log.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all">
      {/* Header - Always Visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Date and Job */}
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground">
                {format(new Date(log.log_date), 'EEEE, MMM d, yyyy')}
              </h3>
              <Badge variant="outline" className="font-medium">{log.jobs?.name}</Badge>
              {phaseLabel && (
                <Badge variant="secondary" className="text-xs">{phaseLabel}</Badge>
              )}
              <Badge 
                variant={isDraft ? "outline" : "secondary"}
                className={isDraft ? 'border-warning text-warning' : 'border-success text-success'}
              >
                {isDraft ? '📝 Draft' : '✅ Complete'}
              </Badge>
            </div>

            {/* Weather & Stats Row */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {log.weather_conditions && (
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full">
                  {getWeatherIcon(log.weather_conditions)}
                  <span className="text-muted-foreground">{getWeatherLabel(log.weather_conditions)}</span>
                  {log.temperature_high && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Thermometer className="h-3 w-3" />
                      {log.temperature_high}°F
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4 text-muted-foreground">
                {totalWorkers > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {totalWorkers} workers
                  </span>
                )}
                {totalHours > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {totalHours.toFixed(0)}h
                  </span>
                )}
                {deliveryCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    {deliveryCount}
                  </span>
                )}
                {inspectionCount > 0 && (
                  <span className="flex items-center gap-1">
                    <ClipboardCheck className="h-4 w-4" />
                    {inspectionCount}
                  </span>
                )}
                {photoCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Image className="h-4 w-4" />
                    {photoCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleExpand}
            className="shrink-0"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          <Separator />

          {/* Photos Row */}
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.slice(0, 6).map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(index);
                    setLightboxOpen(true);
                  }}
                  className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                >
                  <img 
                    src={photo.file_url} 
                    alt={photo.caption || 'Site photo'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {photos.length > 6 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(6);
                    setLightboxOpen(true);
                  }}
                  className="shrink-0 w-24 h-24 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                >
                  +{photos.length - 6}
                </button>
              )}
            </div>
          )}

          {/* Photo Lightbox */}
          {lightboxOpen && photos.length > 0 && (
            <div 
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
              onClick={() => setLightboxOpen(false)}
            >
              <button
                className="absolute top-4 right-4 text-white hover:text-white/80 z-10"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-8 w-8" />
              </button>
              
              {/* Previous Button */}
              {photos.length > 1 && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
                  }}
                >
                  <ChevronUp className="h-6 w-6 -rotate-90" />
                </button>
              )}

              {/* Image */}
              <div 
                className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={photos[lightboxIndex]?.file_url}
                  alt={photos[lightboxIndex]?.caption || 'Site photo'}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
                <div className="mt-4 text-center text-white">
                  {photos[lightboxIndex]?.caption && (
                    <p className="text-lg mb-1">{photos[lightboxIndex].caption}</p>
                  )}
                  <p className="text-sm text-white/60">
                    {lightboxIndex + 1} of {photos.length}
                  </p>
                </div>
              </div>

              {/* Next Button */}
              {photos.length > 1 && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) => (prev + 1) % photos.length);
                  }}
                >
                  <ChevronDown className="h-6 w-6 -rotate-90" />
                </button>
              )}

              {/* Thumbnail Strip */}
              {photos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto p-2">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(index);
                      }}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === lightboxIndex ? 'border-white ring-2 ring-white/50' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo.file_url}
                        alt={photo.caption || `Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column - Crew & Absent */}
            <div className="space-y-3">
              {/* Crew on Site */}
              {(log.crew?.length || 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2 text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Crew on Site ({log.crew?.length})
                  </h4>
                  <div className="space-y-1">
                    {log.crew?.map(crew => (
                      <div key={crew.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded border">
                        <div className="flex items-center gap-2">
                          <HardHat className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">{crew.vendors?.name || crew.trade || 'Unknown'}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {crew.worker_count} × {crew.hours_worked || 0}h
                          {crew.completion_percent !== null && (
                            <Badge variant="outline" className="ml-2 text-xs">{crew.completion_percent}%</Badge>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Absent Crews */}
              {(log.absent_crews?.length || 0) > 0 && (
                <div className="rounded-lg p-3 border bg-muted/30">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2 text-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Absent Crews ({log.absent_crews?.length})
                  </h4>
                  <div className="space-y-1">
                    {log.absent_crews?.map((absent, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {absent.reason === 'called_ahead' ? (
                          <Phone className="h-3 w-3 text-success" />
                        ) : absent.reason === 'no_call_no_show' ? (
                          <PhoneOff className="h-3 w-3 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                        <span className="font-medium text-foreground">{getVendorName(absent.vendor_id)}</span>
                        <span className="text-muted-foreground">- {getReasonLabel(absent.reason)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Deliveries & Inspections */}
            <div className="space-y-3">
              {/* Deliveries */}
              {(log.deliveries?.length || 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2 text-foreground">
                    <Truck className="h-4 w-4 text-primary" />
                    Deliveries ({log.deliveries?.length})
                  </h4>
                  <div className="space-y-1">
                    {log.deliveries?.map(delivery => (
                      <div key={delivery.id} className="text-sm p-2 bg-muted/30 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{delivery.description}</span>
                          {delivery.vendors?.name && (
                            <Badge variant="secondary" className="text-xs">{delivery.vendors.name}</Badge>
                          )}
                        </div>
                        {delivery.quantity && (
                          <span className="text-muted-foreground text-xs">
                            {delivery.quantity} {delivery.unit || 'units'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inspections */}
              {(log.inspections?.length || 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2 text-foreground">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Inspections ({log.inspections?.length})
                  </h4>
                  <div className="space-y-1">
                    {log.inspections?.map(inspection => (
                      <div key={inspection.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded border">
                        <span className="font-medium text-foreground">{inspection.inspection_type}</span>
                        {getResultBadge(inspection.result)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Work Summary */}
          {(log.work_completed || log.work_planned) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {log.work_completed && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <h4 className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-success" />
                    Work Completed
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">{log.work_completed}</p>
                </div>
              )}
              {log.work_planned && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <h4 className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                    📋 Tomorrow's Plan
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">{log.work_planned}</p>
                </div>
              )}
            </div>
          )}

          {/* Delays/Issues */}
          {log.delays_issues && (
            <div className="p-3 bg-muted/30 rounded-lg border border-destructive/20">
              <h4 className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                Delays / Issues
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-2">{log.delays_issues}</p>
            </div>
          )}

          {/* Dumpster & Safety */}
          {(log.dumpster_exchange || log.safety_notes || log.site_visitors) && (
            <div className="flex items-center gap-3 flex-wrap text-sm">
              {log.dumpster_exchange && (
                <Badge variant="outline">🗑️ Dumpster Exchanged</Badge>
              )}
              {log.safety_notes && (
                <Badge variant="outline" className="border-warning text-warning">
                  ⚠️ Has Safety Notes
                </Badge>
              )}
              {log.site_visitors && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Visitors: {log.site_visitors}
                </span>
              )}
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              by {log.created_by || 'Unknown'} • {format(new Date(log.created_at), 'MMM d, h:mm a')}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDelete}
                disabled={deleteLog.isPending}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDuplicate}
                title="Use as template for new log"
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              {isDraft ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={handleComplete} disabled={completeLog.isPending}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleReopen} disabled={reopenLog.isPending}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
