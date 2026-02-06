import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Users,
  Truck,
  ClipboardCheck,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Wind,
  CloudLightning,
  Thermometer,
  Calendar,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Image,
  Upload,
  X,
} from 'lucide-react';
import { useJobs } from '@/hooks/useJobs';
import { useVendors } from '@/hooks/useVendors';
import { useScopeCategories, getUnitLabel } from '@/hooks/useScopeTracking';
import { toast } from 'sonner';
import { useJob } from '@/contexts/JobContext';
import { useUserName } from '@/contexts/UserContext';
import {
  DailyLog,
  DailyLogInsert,
  DailyLogCrew,
  DailyLogDelivery,
  DailyLogInspection,
  DailyLogAttachment,
  AbsentCrew,
  AbsentReason,
  WeatherCondition,
  PlanCompleted,
  InspectionResult,
  PhotoCategory,
  useCreateDailyLog,
  useUpdateDailyLog,
  useUploadDailyLogPhoto,
  useDeleteDailyLogPhoto,
  constructionPhases,
  weatherOptions,
  inspectionTypes,
  tradeOptions,
  absentReasonOptions,
} from '@/hooks/useDailyLogs';

// Map Open-Meteo WMO weather codes to our conditions
const mapWMOCodeToCondition = (code: number): WeatherCondition => {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'partly_cloudy';
  if (code <= 48) return 'cloudy';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rainy';
  if (code <= 77 || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'stormy';
  return 'cloudy';
};

// Geocode an address using Nominatim
const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'User-Agent': 'ConstructionCMSApp/1.0' } }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Fetch weather from Open-Meteo API
const fetchWeatherData = async (lat: number, lon: number): Promise<{
  condition: WeatherCondition;
  tempHigh: number;
  tempLow: number;
} | null> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`
    );
    const data = await response.json();
    if (data && data.daily) {
      return {
        condition: mapWMOCodeToCondition(data.daily.weather_code[0]),
        tempHigh: Math.round(data.daily.temperature_2m_max[0]),
        tempLow: Math.round(data.daily.temperature_2m_min[0]),
      };
    }
    return null;
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
};

interface DailyLogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log?: DailyLog | null;
  templateLog?: DailyLog | null; // For duplicating a log as template
  defaultJobId?: string | null;
}

interface CrewEntry {
  id?: string;
  vendor_id: string | null;
  worker_count: number;
  hours_worked: number | null;
  trade: string | null;
  work_area: string | null;
  completion_percent: number | null;
  po_id: string | null;
  schedule_task_id: string | null;
  notes: string | null;
  // Scope tracking fields
  scope_category_id: string | null;
  quantity_completed: number | null;
  work_quality: 'poor' | 'acceptable' | 'good' | 'excellent' | null;
  ready_for_next_trade: boolean;
}

interface DeliveryEntry {
  id?: string;
  vendor_id: string | null;
  po_id: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  received_by: string | null;
  notes: string | null;
}

interface InspectionEntry {
  id?: string;
  inspection_type: string;
  result: InspectionResult;
  inspector: string | null;
  notes: string | null;
}

const getWeatherIcon = (condition: WeatherCondition | null) => {
  switch (condition) {
    case 'sunny': return <Sun className="h-5 w-5 text-amber-500" />;
    case 'partly_cloudy': return <Cloud className="h-5 w-5 text-blue-400" />;
    case 'cloudy': return <Cloud className="h-5 w-5 text-gray-500" />;
    case 'rainy': return <CloudRain className="h-5 w-5 text-blue-600" />;
    case 'stormy': return <CloudLightning className="h-5 w-5 text-purple-600" />;
    case 'windy': return <Wind className="h-5 w-5 text-teal-500" />;
    case 'snow': return <Snowflake className="h-5 w-5 text-cyan-400" />;
    default: return <Cloud className="h-5 w-5 text-muted-foreground" />;
  }
};

export function DailyLogFormDialog({
  open,
  onOpenChange,
  log,
  templateLog,
  defaultJobId,
}: DailyLogFormDialogProps) {
  const userName = useUserName();
  const { data: jobs = [] } = useJobs();
  const { data: vendors = [] } = useVendors();
  const { data: scopeCategories = [] } = useScopeCategories();
  const createLog = useCreateDailyLog();
  const updateLog = useUpdateDailyLog();
  const uploadPhoto = useUploadDailyLogPhoto();
  const deletePhoto = useDeleteDailyLogPhoto();
  const { selectedJobId: contextJobId } = useJob();

  const isEditing = !!log;
  const today = new Date().toISOString().split('T')[0];
  
  // Prefer prop, then context
  const effectiveJobId = defaultJobId || contextJobId || '';
  const showJobSelector = !effectiveJobId;

  // Form state
  const [jobId, setJobId] = useState(effectiveJobId);
  const [logDate, setLogDate] = useState(today);
  const [constructionPhase, setConstructionPhase] = useState('');
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition | ''>('');
  const [temperatureHigh, setTemperatureHigh] = useState<number | ''>('');
  const [temperatureLow, setTemperatureLow] = useState<number | ''>('');
  const [weatherNotes, setWeatherNotes] = useState('');
  const [planCompleted, setPlanCompleted] = useState<PlanCompleted | ''>('');
  const [planVarianceNotes, setPlanVarianceNotes] = useState('');
  const [workCompleted, setWorkCompleted] = useState('');
  const [workPlanned, setWorkPlanned] = useState('');
  const [delaysIssues, setDelaysIssues] = useState('');
  const [siteVisitors, setSiteVisitors] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [dumpsterExchange, setDumpsterExchange] = useState(false);

  // Child entries
  const [crewEntries, setCrewEntries] = useState<CrewEntry[]>([]);
  const [deliveryEntries, setDeliveryEntries] = useState<DeliveryEntry[]>([]);
  const [inspectionEntries, setInspectionEntries] = useState<InspectionEntry[]>([]);
  const [absentCrews, setAbsentCrews] = useState<AbsentCrew[]>([]);
  
  // Photos state
  const [existingPhotos, setExistingPhotos] = useState<DailyLogAttachment[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; category: PhotoCategory; caption: string }[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Weather loading state
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Fetch weather based on job address
  const fetchWeatherForJob = useCallback(async (selectedJobId: string) => {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job?.address) {
      toast.error('Job has no address for weather lookup');
      return;
    }

    setIsLoadingWeather(true);
    try {
      // Try to geocode the job address
      let coords = await geocodeAddress(job.address);
      
      // Fallback: try with state/city only if full address fails
      if (!coords && job.address.includes(',')) {
        const cityState = job.address.split(',').slice(-2).join(',').trim();
        coords = await geocodeAddress(cityState);
      }
      
      // Default fallback to Sarasota, FL
      if (!coords) {
        coords = { lat: 27.3364, lon: -82.5307 }; // Sarasota, FL
        toast.info('Using default location for weather');
      }

      const weather = await fetchWeatherData(coords.lat, coords.lon);
      if (weather) {
        setWeatherConditions(weather.condition);
        setTemperatureHigh(weather.tempHigh);
        setTemperatureLow(weather.tempLow);
        toast.success('Weather fetched successfully');
      } else {
        toast.error('Could not fetch weather data');
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
      toast.error('Failed to fetch weather');
    } finally {
      setIsLoadingWeather(false);
    }
  }, [jobs]);

  // Auto-fetch weather when job changes (for new logs only)
  useEffect(() => {
    if (open && jobId && !isEditing && !weatherConditions) {
      fetchWeatherForJob(jobId);
    }
  }, [jobId, open, isEditing, weatherConditions, fetchWeatherForJob]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (log) {
        // Editing existing log
        setJobId(log.job_id);
        setLogDate(log.log_date);
        setConstructionPhase(log.construction_phase || '');
        setWeatherConditions(log.weather_conditions || '');
        setTemperatureHigh(log.temperature_high ?? '');
        setTemperatureLow(log.temperature_low ?? '');
        setWeatherNotes(log.weather_notes || '');
        setPlanCompleted(log.plan_completed || '');
        setPlanVarianceNotes(log.plan_variance_notes || '');
        setWorkCompleted(log.work_completed || '');
        setWorkPlanned(log.work_planned || '');
        setDelaysIssues(log.delays_issues || '');
        setSiteVisitors(log.site_visitors || '');
        setSafetyNotes(log.safety_notes || '');
        setDumpsterExchange(log.dumpster_exchange);
        setCrewEntries(log.crew?.map(c => ({
          id: c.id,
          vendor_id: c.vendor_id,
          worker_count: c.worker_count,
          hours_worked: c.hours_worked,
          trade: c.trade,
          work_area: c.work_area,
          completion_percent: c.completion_percent,
          po_id: c.po_id,
          schedule_task_id: c.schedule_task_id,
          notes: c.notes,
          scope_category_id: c.scope_category_id || null,
          quantity_completed: c.quantity_completed ?? null,
          work_quality: c.work_quality || null,
          ready_for_next_trade: c.ready_for_next_trade || false,
        })) || []);
        setDeliveryEntries(log.deliveries?.map(d => ({
          id: d.id,
          vendor_id: d.vendor_id,
          po_id: d.po_id,
          description: d.description,
          quantity: d.quantity,
          unit: d.unit,
          received_by: d.received_by,
          notes: d.notes,
        })) || []);
        setInspectionEntries(log.inspections?.map(i => ({
          id: i.id,
          inspection_type: i.inspection_type,
          result: i.result,
          inspector: i.inspector,
          notes: i.notes,
        })) || []);
        setAbsentCrews(log.absent_crews || []);
        setExistingPhotos(log.attachments || []);
        setPendingPhotos([]);
      } else if (templateLog) {
        // Duplicating from template - copy reusable data, reset day-specific data
        setJobId(templateLog.job_id);
        setLogDate(today); // Reset to today
        setConstructionPhase(templateLog.construction_phase || '');
        // Don't copy weather - will be auto-fetched for today
        setWeatherConditions('');
        setTemperatureHigh('');
        setTemperatureLow('');
        setWeatherNotes('');
        // Don't copy plan completion status
        setPlanCompleted('');
        setPlanVarianceNotes('');
        // Use previous "work_planned" as starting point for "work_completed"
        setWorkCompleted('');
        setWorkPlanned(templateLog.work_planned || '');
        // Don't copy day-specific issues
        setDelaysIssues('');
        setSiteVisitors('');
        setSafetyNotes('');
        setDumpsterExchange(false);
        // Copy crew entries (without IDs - they're new records)
        setCrewEntries(templateLog.crew?.map(c => ({
          vendor_id: c.vendor_id,
          worker_count: c.worker_count,
          hours_worked: c.hours_worked,
          trade: c.trade,
          work_area: c.work_area,
          completion_percent: null, // Reset completion
          po_id: c.po_id,
          schedule_task_id: c.schedule_task_id,
          notes: null, // Reset notes
          scope_category_id: c.scope_category_id || null, // Keep scope category
          quantity_completed: null, // Reset quantity
          work_quality: null, // Reset quality
          ready_for_next_trade: false, // Reset ready state
        })) || []);
        // Don't copy deliveries - they're day-specific
        setDeliveryEntries([]);
        // Don't copy inspections - they're day-specific
        setInspectionEntries([]);
        // Don't copy absent crews - they're day-specific
        setAbsentCrews([]);
        // Don't copy photos
        setExistingPhotos([]);
        setPendingPhotos([]);
      } else {
        // Reset to defaults
        setJobId(effectiveJobId);
        setLogDate(today);
        setConstructionPhase('');
        setWeatherConditions('');
        setTemperatureHigh('');
        setTemperatureLow('');
        setWeatherNotes('');
        setPlanCompleted('');
        setPlanVarianceNotes('');
        setWorkCompleted('');
        setWorkPlanned('');
        setDelaysIssues('');
        setSiteVisitors('');
        setSafetyNotes('');
        setDumpsterExchange(false);
        setCrewEntries([]);
        setDeliveryEntries([]);
        setInspectionEntries([]);
        setAbsentCrews([]);
        setExistingPhotos([]);
        setPendingPhotos([]);
      }
    }
  }, [open, log, templateLog, effectiveJobId, today]);

  const addCrewEntry = () => {
    setCrewEntries([...crewEntries, {
      vendor_id: null,
      worker_count: 1,
      hours_worked: 8,
      trade: null,
      work_area: null,
      completion_percent: null,
      po_id: null,
      schedule_task_id: null,
      notes: null,
      scope_category_id: null,
      quantity_completed: null,
      work_quality: null,
      ready_for_next_trade: false,
    }]);
  };

  const updateCrewEntry = (index: number, updates: Partial<CrewEntry>) => {
    setCrewEntries(crewEntries.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCrewEntry = (index: number) => {
    setCrewEntries(crewEntries.filter((_, i) => i !== index));
  };

  const addDeliveryEntry = () => {
    setDeliveryEntries([...deliveryEntries, {
      vendor_id: null,
      po_id: null,
      description: '',
      quantity: null,
      unit: null,
      received_by: null,
      notes: null,
    }]);
  };

  const updateDeliveryEntry = (index: number, updates: Partial<DeliveryEntry>) => {
    setDeliveryEntries(deliveryEntries.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const removeDeliveryEntry = (index: number) => {
    setDeliveryEntries(deliveryEntries.filter((_, i) => i !== index));
  };

  const addInspectionEntry = () => {
    setInspectionEntries([...inspectionEntries, {
      inspection_type: '',
      result: 'scheduled',
      inspector: null,
      notes: null,
    }]);
  };

  const updateInspectionEntry = (index: number, updates: Partial<InspectionEntry>) => {
    setInspectionEntries(inspectionEntries.map((i, idx) => idx === index ? { ...i, ...updates } : i));
  };

  const removeInspectionEntry = (index: number) => {
    setInspectionEntries(inspectionEntries.filter((_, i) => i !== index));
  };

  const addAbsentCrew = () => {
    setAbsentCrews([...absentCrews, { vendor_id: '', reason: 'no_call_no_show', notes: '' }]);
  };

  const updateAbsentCrew = (index: number, updates: Partial<AbsentCrew>) => {
    setAbsentCrews(absentCrews.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const removeAbsentCrew = (index: number) => {
    setAbsentCrews(absentCrews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (saveAsComplete: boolean = false) => {
    if (!jobId || !logDate) return;

    const logData: DailyLogInsert = {
      job_id: jobId,
      log_date: logDate,
      status: saveAsComplete ? 'completed' : 'draft',
      construction_phase: constructionPhase || null,
      weather_conditions: weatherConditions || null,
      temperature_high: temperatureHigh !== '' ? Number(temperatureHigh) : null,
      temperature_low: temperatureLow !== '' ? Number(temperatureLow) : null,
      weather_notes: weatherNotes || null,
      plan_completed: planCompleted || null,
      plan_variance_notes: planVarianceNotes || null,
      work_completed: workCompleted || null,
      work_planned: workPlanned || null,
      delays_issues: delaysIssues || null,
      site_visitors: siteVisitors || null,
      safety_notes: safetyNotes || null,
      dumpster_exchange: dumpsterExchange,
      absent_crews: absentCrews.filter(a => a.vendor_id),
      created_by: userName,
    };

    const crew = crewEntries.filter(c => c.vendor_id || c.trade);
    const deliveries = deliveryEntries.filter(d => d.description);
    const inspections = inspectionEntries.filter(i => i.inspection_type);

    try {
      let logId: string;
      
      if (isEditing && log) {
        await updateLog.mutateAsync({
          id: log.id,
          ...logData,
          completed_at: saveAsComplete ? new Date().toISOString() : null,
          crew,
          deliveries,
          inspections,
        });
        logId = log.id;
      } else {
        const result = await createLog.mutateAsync({
          ...logData,
          crew,
          deliveries,
          inspections,
        });
        logId = result.id;
      }
      
      // Upload pending photos
      if (pendingPhotos.length > 0) {
        setIsUploadingPhotos(true);
        for (const photo of pendingPhotos) {
          await uploadPhoto.mutateAsync({
            logId,
            file: photo.file,
            category: photo.category,
            caption: photo.caption || undefined,
          });
        }
        setIsUploadingPhotos(false);
        setPendingPhotos([]);
      }
      
      onOpenChange(false);
    } catch (error) {
      setIsUploadingPhotos(false);
      // Error handled in hook
    }
  };

  const isLoading = createLog.isPending || updateLog.isPending || isUploadingPhotos;
  const totalLaborHours = crewEntries.reduce((sum, c) => 
    sum + (c.worker_count * (c.hours_worked || 0)), 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEditing ? 'Edit Daily Log' : 'New Daily Log'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {showJobSelector ? (
                <div>
                  <Label>Job *</Label>
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <Label>Date *</Label>
                <Input 
                  type="date" 
                  value={logDate} 
                  onChange={(e) => setLogDate(e.target.value)} 
                />
              </div>
              <div>
                <Label>Construction Phase</Label>
                <Select value={constructionPhase} onValueChange={setConstructionPhase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {constructionPhases.map(phase => (
                      <SelectItem key={phase.value} value={phase.value}>
                        {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weather Section */}
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium">Weather Conditions</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => jobId && fetchWeatherForJob(jobId)}
                  disabled={!jobId || isLoadingWeather}
                  className="gap-2"
                >
                  {isLoadingWeather ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isLoadingWeather ? 'Fetching...' : 'Fetch Weather'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Conditions</Label>
                  <Select 
                    value={weatherConditions} 
                    onValueChange={(v) => setWeatherConditions(v as WeatherCondition)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select">
                        {weatherConditions && (
                          <span className="flex items-center gap-2">
                            {getWeatherIcon(weatherConditions)}
                            {weatherOptions.find(w => w.value === weatherConditions)?.label}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {weatherOptions.map(w => (
                        <SelectItem key={w.value} value={w.value}>
                          <span className="flex items-center gap-2">
                            {w.icon} {w.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>High °F</Label>
                  <Input 
                    type="number" 
                    value={temperatureHigh} 
                    onChange={(e) => setTemperatureHigh(e.target.value ? Number(e.target.value) : '')}
                    placeholder="75"
                  />
                </div>
                <div>
                  <Label>Low °F</Label>
                  <Input 
                    type="number" 
                    value={temperatureLow} 
                    onChange={(e) => setTemperatureLow(e.target.value ? Number(e.target.value) : '')}
                    placeholder="62"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input 
                    value={weatherNotes} 
                    onChange={(e) => setWeatherNotes(e.target.value)}
                    placeholder="Light breeze..."
                  />
                </div>
              </div>
            </div>

            {/* Yesterday's Plan */}
            <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-medium">Yesterday's Plan Status</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Was yesterday's plan completed?</Label>
                  <Select 
                    value={planCompleted} 
                    onValueChange={(v) => setPlanCompleted(v as PlanCompleted)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">
                        <span className="flex items-center gap-2">✅ Yes</span>
                      </SelectItem>
                      <SelectItem value="partial">
                        <span className="flex items-center gap-2">⚠️ Partial</span>
                      </SelectItem>
                      <SelectItem value="no">
                        <span className="flex items-center gap-2">❌ No</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(planCompleted === 'partial' || planCompleted === 'no') && (
                  <div>
                    <Label>Variance Notes</Label>
                    <Input 
                      value={planVarianceNotes} 
                      onChange={(e) => setPlanVarianceNotes(e.target.value)}
                      placeholder="Why wasn't the plan completed?"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tabs for Crew, Deliveries, Inspections, Photos */}
            <Tabs defaultValue="crew" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="crew" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Crew</span> ({crewEntries.length})
                </TabsTrigger>
                <TabsTrigger value="deliveries" className="gap-2">
                  <Truck className="h-4 w-4" />
                  <span className="hidden sm:inline">Deliveries</span> ({deliveryEntries.length})
                </TabsTrigger>
                <TabsTrigger value="inspections" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Inspections</span> ({inspectionEntries.length})
                </TabsTrigger>
                <TabsTrigger value="photos" className="gap-2">
                  <Image className="h-4 w-4" />
                  <span className="hidden sm:inline">Photos</span> (0)
                </TabsTrigger>
              </TabsList>

              {/* Crew Tab */}
              <TabsContent value="crew" className="space-y-4 mt-4">
                {crewEntries.length > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{crewEntries.length} crew entries</span>
                    <Badge variant="secondary">
                      {totalLaborHours.toFixed(1)} total labor hours
                    </Badge>
                  </div>
                )}
                {crewEntries.map((crew, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Crew #{index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCrewEntry(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Vendor/Sub</Label>
                        <Select
                          value={crew.vendor_id || ''}
                          onValueChange={(v) => updateCrewEntry(index, { vendor_id: v || null })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Trade</Label>
                        <Select
                          value={crew.trade || ''}
                          onValueChange={(v) => updateCrewEntry(index, { trade: v || null })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                          <SelectContent>
                            {tradeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Workers</Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-9"
                          value={crew.worker_count}
                          onChange={(e) => updateCrewEntry(index, { worker_count: Number(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Hours</Label>
                        <Input
                          type="number"
                          step={0.5}
                          className="h-9"
                          value={crew.hours_worked ?? ''}
                          onChange={(e) => updateCrewEntry(index, { hours_worked: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Work Area</Label>
                        <Input
                          className="h-9"
                          value={crew.work_area || ''}
                          onChange={(e) => updateCrewEntry(index, { work_area: e.target.value || null })}
                          placeholder="e.g., 2nd floor bedrooms"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Completion %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-9"
                          value={crew.completion_percent ?? ''}
                          onChange={(e) => updateCrewEntry(index, { completion_percent: e.target.value ? Number(e.target.value) : null })}
                          placeholder="0-100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input
                          className="h-9"
                          value={crew.notes || ''}
                          onChange={(e) => updateCrewEntry(index, { notes: e.target.value || null })}
                          placeholder="Additional notes"
                        />
                      </div>
                    </div>
                    {/* Scope Tracking Section */}
                    <div className="border-t pt-3 mt-3">
                      <Label className="text-xs text-muted-foreground mb-2 block">Performance Tracking (Optional)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Scope Category</Label>
                          <Select
                            value={crew.scope_category_id || ''}
                            onValueChange={(v) => updateCrewEntry(index, { scope_category_id: v || null })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                              {scopeCategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name} ({cat.trade})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Qty Completed {crew.scope_category_id && (() => {
                              const cat = scopeCategories.find(c => c.id === crew.scope_category_id);
                              return cat ? `(${getUnitLabel(cat)})` : '';
                            })()}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-9"
                            value={crew.quantity_completed ?? ''}
                            onChange={(e) => updateCrewEntry(index, { quantity_completed: e.target.value ? Number(e.target.value) : null })}
                            placeholder="Amount"
                            disabled={!crew.scope_category_id}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Work Quality</Label>
                          <Select
                            value={crew.work_quality || ''}
                            onValueChange={(v) => updateCrewEntry(index, { work_quality: (v || null) as any })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Rate quality" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="excellent">⭐ Excellent</SelectItem>
                              <SelectItem value="good">👍 Good</SelectItem>
                              <SelectItem value="acceptable">✓ Acceptable</SelectItem>
                              <SelectItem value="poor">⚠️ Poor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end pb-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`ready-${index}`}
                              checked={crew.ready_for_next_trade}
                              onCheckedChange={(checked) => updateCrewEntry(index, { ready_for_next_trade: !!checked })}
                            />
                            <Label htmlFor={`ready-${index}`} className="text-xs cursor-pointer">
                              Ready for next trade
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={addCrewEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Crew Entry
                </Button>

                {/* Absent Crews Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Absent Crews
                  </h4>
                  {absentCrews.map((absent, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={absent.vendor_id}
                          onValueChange={(v) => updateAbsentCrew(index, { vendor_id: v })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select vendor/sub" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={absent.reason}
                          onValueChange={(v) => updateAbsentCrew(index, { reason: v as AbsentReason })}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {absentReasonOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => removeAbsentCrew(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        className="h-8"
                        value={absent.notes || ''}
                        onChange={(e) => updateAbsentCrew(index, { notes: e.target.value })}
                        placeholder="Additional notes (optional)"
                      />
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addAbsentCrew}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Absent Crew
                  </Button>
                </div>
              </TabsContent>

              {/* Deliveries Tab */}
              <TabsContent value="deliveries" className="space-y-4 mt-4">
                {deliveryEntries.map((delivery, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Delivery #{index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDeliveryEntry(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Description *</Label>
                        <Input
                          className="h-9"
                          value={delivery.description}
                          onChange={(e) => updateDeliveryEntry(index, { description: e.target.value })}
                          placeholder="What was delivered?"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Vendor/Supplier</Label>
                        <Select
                          value={delivery.vendor_id || ''}
                          onValueChange={(v) => updateDeliveryEntry(index, { vendor_id: v || null })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Received By</Label>
                        <Input
                          className="h-9"
                          value={delivery.received_by || ''}
                          onChange={(e) => updateDeliveryEntry(index, { received_by: e.target.value || null })}
                          placeholder="Name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          className="h-9"
                          value={delivery.quantity ?? ''}
                          onChange={(e) => updateDeliveryEntry(index, { quantity: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Input
                          className="h-9"
                          value={delivery.unit || ''}
                          onChange={(e) => updateDeliveryEntry(index, { unit: e.target.value || null })}
                          placeholder="e.g., LF, pallets"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input
                          className="h-9"
                          value={delivery.notes || ''}
                          onChange={(e) => updateDeliveryEntry(index, { notes: e.target.value || null })}
                          placeholder="Condition, partial, etc."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={addDeliveryEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Delivery
                </Button>
              </TabsContent>

              {/* Inspections Tab */}
              <TabsContent value="inspections" className="space-y-4 mt-4">
                {inspectionEntries.map((inspection, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Inspection #{index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInspectionEntry(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Type *</Label>
                        <Select
                          value={inspection.inspection_type}
                          onValueChange={(v) => updateInspectionEntry(index, { inspection_type: v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {inspectionTypes.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Result</Label>
                        <Select
                          value={inspection.result}
                          onValueChange={(v) => updateInspectionEntry(index, { result: v as InspectionResult })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">📅 Scheduled</SelectItem>
                            <SelectItem value="passed">✅ Passed</SelectItem>
                            <SelectItem value="failed">❌ Failed</SelectItem>
                            <SelectItem value="partial">⚠️ Partial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Inspector</Label>
                        <Input
                          className="h-9"
                          value={inspection.inspector || ''}
                          onChange={(e) => updateInspectionEntry(index, { inspector: e.target.value || null })}
                          placeholder="Inspector name"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input
                          className="h-9"
                          value={inspection.notes || ''}
                          onChange={(e) => updateInspectionEntry(index, { notes: e.target.value || null })}
                          placeholder="Corrections needed, etc."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={addInspectionEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Inspection
                </Button>
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="space-y-4 mt-4">
                {/* Photo Upload Area with Drag & Drop */}
                <div className="space-y-3">
                  <Label>Add Photos</Label>
                  <label 
                    className={`block border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                      isDragging 
                        ? 'border-primary bg-primary/10 scale-[1.02]' 
                        : 'border-muted-foreground/30 bg-muted/20 hover:bg-muted/30 hover:border-muted-foreground/50'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      
                      const files = Array.from(e.dataTransfer.files).filter(
                        file => file.type.startsWith('image/')
                      );
                      if (files.length > 0) {
                        const newPhotos = files.map(file => ({
                          file,
                          category: 'progress' as PhotoCategory,
                          caption: '',
                        }));
                        setPendingPhotos([...pendingPhotos, ...newPhotos]);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const newPhotos = files.map(file => ({
                          file,
                          category: 'progress' as PhotoCategory,
                          caption: '',
                        }));
                        setPendingPhotos([...pendingPhotos, ...newPhotos]);
                        e.target.value = ''; // Reset input
                      }}
                    />
                    {isDragging ? (
                      <>
                        <Upload className="h-10 w-10 mx-auto text-primary mb-2 animate-bounce" />
                        <p className="font-semibold text-primary">Drop photos here!</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="font-medium text-sm">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB each</p>
                      </>
                    )}
                  </label>
                </div>

                {/* Pending Photos (not yet uploaded) */}
                {pendingPhotos.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Pending Upload ({pendingPhotos.length})
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {pendingPhotos.map((photo, index) => (
                        <div key={index} className="relative border rounded-lg overflow-hidden bg-muted/30">
                          <img
                            src={URL.createObjectURL(photo.file)}
                            alt={`Pending ${index + 1}`}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-2 space-y-2">
                            <Select
                              value={photo.category}
                              onValueChange={(v) => {
                                const updated = [...pendingPhotos];
                                updated[index].category = v as PhotoCategory;
                                setPendingPhotos(updated);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="progress">📸 Progress</SelectItem>
                                <SelectItem value="delivery">📦 Delivery</SelectItem>
                                <SelectItem value="safety">⚠️ Safety</SelectItem>
                                <SelectItem value="inspection">✅ Inspection</SelectItem>
                                <SelectItem value="other">📎 Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 text-xs"
                              placeholder="Caption (optional)"
                              value={photo.caption}
                              onChange={(e) => {
                                const updated = [...pendingPhotos];
                                updated[index].caption = e.target.value;
                                setPendingPhotos(updated);
                              }}
                            />
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => {
                              setPendingPhotos(pendingPhotos.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      📌 Photos will be uploaded when you save the log
                    </p>
                  </div>
                )}

                {/* Existing Photos (already uploaded) */}
                {existingPhotos.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Uploaded Photos ({existingPhotos.length})
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {existingPhotos.map((photo) => (
                        <div key={photo.id} className="relative border rounded-lg overflow-hidden bg-muted/30">
                          <img
                            src={photo.file_url}
                            alt={photo.caption || photo.file_name}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-2">
                            <Badge variant="secondary" className="text-xs">
                              {photo.category === 'progress' && '📸 Progress'}
                              {photo.category === 'delivery' && '📦 Delivery'}
                              {photo.category === 'safety' && '⚠️ Safety'}
                              {photo.category === 'inspection' && '✅ Inspection'}
                              {photo.category === 'other' && '📎 Other'}
                            </Badge>
                            {photo.caption && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={async () => {
                              await deletePhoto.mutateAsync({ id: photo.id, fileUrl: photo.file_url });
                              setExistingPhotos(existingPhotos.filter(p => p.id !== photo.id));
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingPhotos.length === 0 && existingPhotos.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    💡 Add photos for progress documentation, deliveries, safety concerns, and inspections
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Dumpster Exchange */}
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="dumpster"
                checked={dumpsterExchange}
                onCheckedChange={(checked) => setDumpsterExchange(!!checked)}
              />
              <Label htmlFor="dumpster" className="cursor-pointer">
                🗑️ Dumpster exchanged today
              </Label>
            </div>

            {/* Work Summary */}
            <div className="space-y-4">
              <h3 className="font-medium">Work Summary</h3>
              <div>
                <Label>Work Completed Today</Label>
                <Textarea
                  value={workCompleted}
                  onChange={(e) => setWorkCompleted(e.target.value)}
                  placeholder="Describe all work performed today..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Tomorrow's Plan</Label>
                <Textarea
                  value={workPlanned}
                  onChange={(e) => setWorkPlanned(e.target.value)}
                  placeholder="What's planned for tomorrow..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Delays / Issues</Label>
                  <Textarea
                    value={delaysIssues}
                    onChange={(e) => setDelaysIssues(e.target.value)}
                    placeholder="Any problems encountered..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Safety Notes</Label>
                  <Textarea
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    placeholder="Safety incidents or concerns..."
                    rows={2}
                  />
                </div>
              </div>
              <div>
                <Label>Site Visitors</Label>
                <Input
                  value={siteVisitors}
                  onChange={(e) => setSiteVisitors(e.target.value)}
                  placeholder="Inspectors, owners, etc."
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => handleSubmit(false)} 
            disabled={isLoading || !jobId || !logDate}
          >
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSubmit(true)} 
            disabled={isLoading || !jobId || !logDate}
          >
            {isEditing ? 'Update & Complete' : 'Save & Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
