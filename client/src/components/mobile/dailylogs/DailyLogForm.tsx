/**
 * Daily Log Form Component for Mobile PWA
 * Phase 1.1d: Daily logs with voice input
 */

import { useState, useEffect } from 'react';
import { useVoiceInput } from '@/hooks/mobile/useVoiceInput';
import { useJob } from '@/contexts/JobContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mic,
  MicOff,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  Zap,
  Loader2,
  Save,
  Check,
  AlertCircle,
  Users,
  Truck,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface Job {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface CrewEntry {
  id?: string;
  vendor_id: string;
  worker_count: number;
  hours_worked: number;
  trade: string;
  notes: string;
}

interface DeliveryEntry {
  id?: string;
  vendor_id: string;
  description: string;
  quantity: number;
  unit: string;
  notes: string;
}

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'windy' | 'snow';

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: React.ElementType }[] = [
  { value: 'sunny', label: 'Sunny', icon: Sun },
  { value: 'partly_cloudy', label: 'Partly Cloudy', icon: Cloud },
  { value: 'cloudy', label: 'Cloudy', icon: Cloud },
  { value: 'rainy', label: 'Rainy', icon: CloudRain },
  { value: 'stormy', label: 'Stormy', icon: Zap },
  { value: 'windy', label: 'Windy', icon: Wind },
  { value: 'snow', label: 'Snow', icon: CloudSnow },
];

export function DailyLogForm() {
  const { user } = useAuth();
  const { selectedJob } = useJob();
  const queryClient = useQueryClient();

  const [selectedJobId, setSelectedJobId] = useState<string>(selectedJob?.id || '');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<WeatherCondition>('sunny');
  const [tempHigh, setTempHigh] = useState('');
  const [tempLow, setTempLow] = useState('');
  const [workCompleted, setWorkCompleted] = useState('');
  const [delaysIssues, setDelaysIssues] = useState('');
  const [siteVisitors, setSiteVisitors] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [crewEntries, setCrewEntries] = useState<CrewEntry[]>([]);
  const [deliveryEntries, setDeliveryEntries] = useState<DeliveryEntry[]>([]);

  // Voice input state - track which field is being dictated
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    error: voiceError,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    onResult: (text, isFinal) => {
      if (isFinal && activeVoiceField) {
        // Update the active field with the transcript
        switch (activeVoiceField) {
          case 'workCompleted':
            setWorkCompleted(prev => prev + (prev ? ' ' : '') + text);
            break;
          case 'delaysIssues':
            setDelaysIssues(prev => prev + (prev ? ' ' : '') + text);
            break;
          case 'siteVisitors':
            setSiteVisitors(prev => prev + (prev ? ' ' : '') + text);
            break;
          case 'safetyNotes':
            setSafetyNotes(prev => prev + (prev ? ' ' : '') + text);
            break;
        }
        resetTranscript();
      }
    },
  });

  // Fetch jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v2_jobs')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as Job[];
    },
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v2_vendors')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Get auth headers
  const getHeaders = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'completed') => {
      const headers = await getHeaders();
      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          job_id: selectedJobId,
          log_date: logDate,
          weather_conditions: weather,
          temperature_high: tempHigh ? parseInt(tempHigh) : null,
          temperature_low: tempLow ? parseInt(tempLow) : null,
          work_completed: workCompleted || null,
          delays_issues: delaysIssues || null,
          site_visitors: siteVisitors || null,
          safety_notes: safetyNotes || null,
          status,
          created_by: user?.email || 'mobile_user',
          crew_entries: crewEntries.filter(c => c.vendor_id || c.trade),
          delivery_entries: deliveryEntries.filter(d => d.description),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to save daily log');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      toast({
        title: 'Daily log saved',
        description: 'Your daily log has been saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle voice for a field
  const toggleVoice = (field: string) => {
    if (isListening && activeVoiceField === field) {
      stopListening();
      setActiveVoiceField(null);
    } else {
      resetTranscript();
      setActiveVoiceField(field);
      startListening();
    }
  };

  // Add crew entry
  const addCrewEntry = () => {
    setCrewEntries([...crewEntries, {
      vendor_id: '',
      worker_count: 1,
      hours_worked: 8,
      trade: '',
      notes: '',
    }]);
  };

  // Remove crew entry
  const removeCrewEntry = (index: number) => {
    setCrewEntries(crewEntries.filter((_, i) => i !== index));
  };

  // Update crew entry
  const updateCrewEntry = (index: number, updates: Partial<CrewEntry>) => {
    setCrewEntries(crewEntries.map((entry, i) =>
      i === index ? { ...entry, ...updates } : entry
    ));
  };

  // Add delivery entry
  const addDeliveryEntry = () => {
    setDeliveryEntries([...deliveryEntries, {
      vendor_id: '',
      description: '',
      quantity: 1,
      unit: '',
      notes: '',
    }]);
  };

  // Remove delivery entry
  const removeDeliveryEntry = (index: number) => {
    setDeliveryEntries(deliveryEntries.filter((_, i) => i !== index));
  };

  // Update delivery entry
  const updateDeliveryEntry = (index: number, updates: Partial<DeliveryEntry>) => {
    setDeliveryEntries(deliveryEntries.map((entry, i) =>
      i === index ? { ...entry, ...updates } : entry
    ));
  };

  // Voice input button component
  const VoiceButton = ({ field }: { field: string }) => {
    if (!voiceSupported) return null;

    const isActive = isListening && activeVoiceField === field;

    return (
      <Button
        type="button"
        variant={isActive ? 'default' : 'ghost'}
        size="sm"
        onClick={() => toggleVoice(field)}
        className={cn(
          'h-8 w-8 p-0',
          isActive && 'bg-red-500 hover:bg-red-600 animate-pulse'
        )}
      >
        {isActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Job & Date */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Job</label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Weather */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weather</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.value}
                  variant={weather === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWeather(option.value)}
                  className="flex items-center gap-1"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">High</label>
              <Input
                type="number"
                placeholder="High"
                value={tempHigh}
                onChange={(e) => setTempHigh(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Low</label>
              <Input
                type="number"
                placeholder="Low"
                value={tempLow}
                onChange={(e) => setTempLow(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="work" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="work">
            <FileText className="h-4 w-4 mr-1" />
            Work
          </TabsTrigger>
          <TabsTrigger value="crew">
            <Users className="h-4 w-4 mr-1" />
            Crew
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <Truck className="h-4 w-4 mr-1" />
            Deliveries
          </TabsTrigger>
        </TabsList>

        {/* Work Tab */}
        <TabsContent value="work" className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Work Completed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Work Completed</label>
                  <VoiceButton field="workCompleted" />
                </div>
                <Textarea
                  placeholder="Describe work completed today..."
                  value={workCompleted}
                  onChange={(e) => setWorkCompleted(e.target.value)}
                  rows={3}
                />
                {activeVoiceField === 'workCompleted' && interimTranscript && (
                  <p className="text-sm text-muted-foreground italic">{interimTranscript}</p>
                )}
              </div>

              {/* Delays/Issues */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Delays / Issues</label>
                  <VoiceButton field="delaysIssues" />
                </div>
                <Textarea
                  placeholder="Any delays or issues..."
                  value={delaysIssues}
                  onChange={(e) => setDelaysIssues(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Site Visitors */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Site Visitors</label>
                  <VoiceButton field="siteVisitors" />
                </div>
                <Textarea
                  placeholder="Inspectors, clients, etc..."
                  value={siteVisitors}
                  onChange={(e) => setSiteVisitors(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Safety Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Safety Notes</label>
                  <VoiceButton field="safetyNotes" />
                </div>
                <Textarea
                  placeholder="Safety observations..."
                  value={safetyNotes}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crew Tab */}
        <TabsContent value="crew" className="space-y-4">
          {crewEntries.map((entry, index) => (
            <Card key={index}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Crew #{index + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCrewEntry(index)}
                    className="text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Select
                  value={entry.vendor_id}
                  onValueChange={(v) => updateCrewEntry(index, { vendor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Workers"
                    value={entry.worker_count}
                    onChange={(e) => updateCrewEntry(index, { worker_count: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    placeholder="Hours"
                    value={entry.hours_worked}
                    onChange={(e) => updateCrewEntry(index, { hours_worked: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <Input
                  placeholder="Trade (e.g., Framing, Plumbing)"
                  value={entry.trade}
                  onChange={(e) => updateCrewEntry(index, { trade: e.target.value })}
                />
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addCrewEntry}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Crew Entry
          </Button>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="space-y-4">
          {deliveryEntries.map((entry, index) => (
            <Card key={index}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Delivery #{index + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDeliveryEntry(index)}
                    className="text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Select
                  value={entry.vendor_id}
                  onValueChange={(v) => updateDeliveryEntry(index, { vendor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Description"
                  value={entry.description}
                  onChange={(e) => updateDeliveryEntry(index, { description: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={entry.quantity}
                    onChange={(e) => updateDeliveryEntry(index, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    placeholder="Unit"
                    value={entry.unit}
                    onChange={(e) => updateDeliveryEntry(index, { unit: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addDeliveryEntry}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Delivery
          </Button>
        </TabsContent>
      </Tabs>

      {/* Voice Error */}
      {voiceError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{voiceError}</p>
          </CardContent>
        </Card>
      )}

      {/* Voice Not Supported */}
      {!voiceSupported && (
        <Card className="border-yellow-500 bg-yellow-500/5">
          <CardContent className="py-3 flex items-center gap-2">
            <MicOff className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              Voice input is not supported on this device.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Save Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => saveMutation.mutate('draft')}
          disabled={saveMutation.isPending || !selectedJobId}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Draft
        </Button>
        <Button
          onClick={() => saveMutation.mutate('completed')}
          disabled={saveMutation.isPending || !selectedJobId}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Complete
        </Button>
      </div>
    </div>
  );
}

export default DailyLogForm;
