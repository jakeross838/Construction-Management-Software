import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Wind,
  CloudLightning,
  Thermometer,
  Users,
  Truck,
  ClipboardCheck,
  Edit,
  Trash2,
  CheckCircle,
  RotateCcw,
  Clock,
  AlertTriangle,
  MapPin,
  HardHat,
  Image,
  Phone,
  PhoneOff,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  DailyLog,
  WeatherCondition,
  AbsentReason,
  useCompleteDailyLog,
  useReopenDailyLog,
  useDeleteDailyLog,
  constructionPhases,
  absentReasonOptions,
} from '@/hooks/useDailyLogs';
import { useVendors } from '@/hooks/useVendors';

interface DailyLogViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: DailyLog | null;
  onEdit?: () => void;
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
    default: return <Cloud className={`${size} text-muted-foreground`} />;
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
  return condition ? labels[condition] : 'Unknown';
};

const getResultBadge = (result: string) => {
  switch (result) {
    case 'passed':
      return <Badge variant="outline" className="border-success text-success">✅ Passed</Badge>;
    case 'failed':
      return <Badge variant="outline" className="border-destructive text-destructive">❌ Failed</Badge>;
    case 'partial':
      return <Badge variant="outline" className="border-warning text-warning">⚠️ Partial</Badge>;
    default:
      return <Badge variant="secondary">📅 Scheduled</Badge>;
  }
};

const getReasonLabel = (reason: AbsentReason) => {
  const opt = absentReasonOptions.find(o => o.value === reason);
  return opt?.label || reason;
};

const getReasonIcon = (reason: AbsentReason) => {
  switch (reason) {
    case 'called_ahead':
      return <Phone className="h-4 w-4 text-success" />;
    case 'no_call_no_show':
      return <PhoneOff className="h-4 w-4 text-destructive" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-warning" />;
  }
};

export function DailyLogViewDialog({
  open,
  onOpenChange,
  log,
  onEdit,
}: DailyLogViewDialogProps) {
  const { data: vendors = [] } = useVendors();
  const completeLog = useCompleteDailyLog();
  const reopenLog = useReopenDailyLog();
  const deleteLog = useDeleteDailyLog();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  if (!log) return null;

  const isDraft = log.status === 'draft';
  const phaseLabel = constructionPhases.find(p => p.value === log.construction_phase)?.label;
  const totalLaborHours = (log.crew || []).reduce((sum, c) => 
    sum + (c.worker_count * (c.hours_worked || 0)), 0
  );
  const totalWorkers = (log.crew || []).reduce((sum, c) => sum + c.worker_count, 0);
  const photos = log.attachments || [];

  const handleComplete = async () => {
    await completeLog.mutateAsync(log.id);
  };

  const handleReopen = async () => {
    await reopenLog.mutateAsync(log.id);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this daily log?')) {
      await deleteLog.mutateAsync(log.id);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <Calendar className="h-6 w-6 text-primary" />
                  {format(parseISO(log.log_date), 'EEEE, MMMM d, yyyy')}
                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm px-3 py-1">{log.jobs?.name}</Badge>
                  {phaseLabel && <Badge variant="secondary" className="text-sm px-3 py-1">{phaseLabel}</Badge>}
                  <Badge 
                    variant={isDraft ? "outline" : "secondary"}
                    className={`text-sm px-3 py-1 ${isDraft ? 'border-warning text-warning' : 'border-success text-success'}`}
                  >
                    {isDraft ? '📝 Draft' : '✅ Completed'}
                  </Badge>
                </div>
                {log.jobs?.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {log.jobs.address}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(95vh-200px)]">
            <div className="p-6 space-y-6">
              {/* Weather & Stats Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weather Card */}
                {log.weather_conditions && (
                  <div className="bg-muted/30 rounded-xl p-5 border">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-card rounded-full border">
                        {getWeatherIcon(log.weather_conditions, 'h-10 w-10')}
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-semibold">{getWeatherLabel(log.weather_conditions)}</p>
                        {(log.temperature_high || log.temperature_low) && (
                          <div className="flex items-center gap-3 mt-1">
                            <Thermometer className="h-4 w-4 text-muted-foreground" />
                            {log.temperature_high && (
                              <span className="text-destructive font-medium">
                                ↑ {log.temperature_high}°F
                              </span>
                            )}
                            {log.temperature_low && (
                              <span className="text-primary font-medium">
                                ↓ {log.temperature_low}°F
                              </span>
                            )}
                          </div>
                        )}
                        {log.weather_notes && (
                          <p className="text-sm text-muted-foreground mt-2">{log.weather_notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/30 rounded-xl p-4 text-center border">
                    <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{totalWorkers}</p>
                    <p className="text-xs text-muted-foreground">Workers</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center border">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{totalLaborHours.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Hours</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center border">
                    <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{log.deliveries?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Deliveries</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center border">
                    <ClipboardCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{log.inspections?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Inspections</p>
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              {photos.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Image className="h-5 w-5 text-primary" />
                    Site Photos ({photos.length})
                  </h3>
                  <Carousel className="w-full">
                    <CarouselContent className="-ml-2">
                      {photos.map((photo) => (
                        <CarouselItem key={photo.id} className="pl-2 basis-1/3 md:basis-1/4 lg:basis-1/5">
                          <div 
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all border"
                            onClick={() => setSelectedPhoto(photo.file_url)}
                          >
                            <img 
                              src={photo.file_url} 
                              alt={photo.caption || 'Site photo'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {photo.caption && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                          )}
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="-left-3" />
                    <CarouselNext className="-right-3" />
                  </Carousel>
                </div>
              )}

              {photos.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-6 text-center">
                  <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No photos attached to this log</p>
                </div>
              )}

              {/* Yesterday's Plan Status */}
              {log.plan_completed && (
                <div className="rounded-xl p-4 border bg-muted/30">
                  <div className="flex items-center gap-2 font-medium">
                    {log.plan_completed === 'yes' ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : log.plan_completed === 'partial' ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Yesterday's Plan: {
                      log.plan_completed === 'yes' ? 'Completed as planned' :
                      log.plan_completed === 'partial' ? 'Partially completed' : 'Not completed'
                    }</span>
                  </div>
                  {log.plan_variance_notes && (
                    <p className="text-sm text-muted-foreground mt-2 ml-6">{log.plan_variance_notes}</p>
                  )}
                </div>
              )}

              {/* Two Column Layout for Crew/Deliveries */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Crew Section */}
                <div>
                  {(log.crew?.length || 0) > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-lg">
                        <Users className="h-5 w-5 text-primary" />
                        Crew on Site ({log.crew?.length})
                      </h3>
                      <div className="space-y-2">
                        {log.crew?.map(crew => (
                          <div key={crew.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-card rounded-lg border">
                                <HardHat className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {crew.vendors?.name || crew.trade || 'Unknown'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {crew.worker_count} worker{crew.worker_count !== 1 ? 's' : ''} • {crew.hours_worked || 0}h
                                  {crew.work_area && ` • ${crew.work_area}`}
                                </p>
                                {crew.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{crew.notes}</p>
                                )}
                              </div>
                            </div>
                            {crew.completion_percent !== null && (
                              <Badge variant="outline">
                                {crew.completion_percent}%
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Absent Crews */}
                  {(log.absent_crews?.length || 0) > 0 && (
                    <div className="mt-4 bg-muted/30 rounded-xl p-4 border">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        Absent Crews ({log.absent_crews?.length})
                      </h3>
                      <div className="space-y-2">
                        {log.absent_crews?.map((absent, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 bg-card rounded-lg border">
                            {getReasonIcon(absent.reason)}
                            <div className="flex-1">
                              <p className="font-medium">{getVendorName(absent.vendor_id)}</p>
                              <p className="text-sm text-muted-foreground">
                                {getReasonLabel(absent.reason)}
                              </p>
                              {absent.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{absent.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deliveries & Inspections Column */}
                <div className="space-y-4">
                  {/* Deliveries Section */}
                  {(log.deliveries?.length || 0) > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-lg">
                        <Truck className="h-5 w-5 text-primary" />
                        Deliveries ({log.deliveries?.length})
                      </h3>
                      <div className="space-y-2">
                        {log.deliveries?.map(delivery => (
                          <div key={delivery.id} className="p-3 bg-muted/30 rounded-lg border">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium">{delivery.description}</p>
                              {delivery.vendors?.name && (
                                <Badge variant="secondary">{delivery.vendors.name}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {delivery.quantity && `${delivery.quantity} ${delivery.unit || 'units'}`}
                              {delivery.received_by && ` • Received by: ${delivery.received_by}`}
                            </p>
                            {delivery.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{delivery.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inspections Section */}
                  {(log.inspections?.length || 0) > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-lg">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                        Inspections ({log.inspections?.length})
                      </h3>
                      <div className="space-y-2">
                        {log.inspections?.map(inspection => (
                          <div key={inspection.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                            <div>
                              <p className="font-medium">{inspection.inspection_type}</p>
                              {inspection.inspector && (
                                <p className="text-sm text-muted-foreground">Inspector: {inspection.inspector}</p>
                              )}
                              {inspection.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{inspection.notes}</p>
                              )}
                            </div>
                            {getResultBadge(inspection.result)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dumpster Exchange */}
              {log.dumpster_exchange && (
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border">
                  <span className="text-2xl">🗑️</span>
                  <span className="font-medium">Dumpster was exchanged today</span>
                </div>
              )}

              <Separator />

              {/* Work Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {log.work_completed && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Work Completed
                    </h3>
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <p className="text-muted-foreground whitespace-pre-wrap">{log.work_completed}</p>
                    </div>
                  </div>
                )}

                {log.work_planned && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      📋 Tomorrow's Plan
                    </h3>
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <p className="text-muted-foreground whitespace-pre-wrap">{log.work_planned}</p>
                    </div>
                  </div>
                )}
              </div>

              {log.delays_issues && (
                <div className="bg-muted/30 rounded-xl p-4 border border-destructive/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delays / Issues
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{log.delays_issues}</p>
                </div>
              )}

              {log.safety_notes && (
                <div className="bg-muted/30 rounded-xl p-4 border border-warning/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Safety Notes
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{log.safety_notes}</p>
                </div>
              )}

              {log.site_visitors && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Site Visitors
                  </h3>
                  <p className="text-muted-foreground p-3 bg-muted/30 rounded-lg border">{log.site_visitors}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="text-sm text-muted-foreground pt-4 border-t flex flex-wrap gap-x-4 gap-y-1">
                <span>Created by <span className="font-medium">{log.created_by || 'Unknown'}</span></span>
                <span>on {format(new Date(log.created_at), 'MMM d, yyyy \'at\' h:mm a')}</span>
                {log.completed_at && (
                  <span className="text-success">
                    • Completed on {format(new Date(log.completed_at), 'MMM d, yyyy \'at\' h:mm a')}
                  </span>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t flex-wrap gap-2">
            <div className="flex gap-2 flex-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDelete}
                disabled={deleteLog.isPending}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
            <div className="flex gap-2">
              {isDraft ? (
                <>
                  <Button variant="outline" onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button onClick={handleComplete} disabled={completeLog.isPending}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleReopen} disabled={reopenLog.isPending}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reopen for Editing
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black/95">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img 
              src={selectedPhoto} 
              alt="Full size" 
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
