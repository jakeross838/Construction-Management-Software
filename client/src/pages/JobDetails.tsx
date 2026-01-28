import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Home,
  Bed,
  Bath,
  Car,
  Ruler,
  Building,
  MapPin,
  Calendar,
  Users,
  Hammer,
  Thermometer,
  Droplets,
  Zap,
  Pencil,
  Save,
  X,
  Phone,
  Mail,
  User,
  FileText,
  Shield,
  Plus,
  Trash2,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useJob as useJobData, useUpdateJob, useDBJobs } from '@/hooks/useFinancialData';
import { DBJob, formatCurrency, formatDate } from '@/types/financial';

const statusOptions = [
  { value: 'pre_construction', label: 'Pre-Construction' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

const JobDetailsPage = () => {
  const { selectedJobId } = useJob();
  const { data: job, isLoading } = useJobData(selectedJobId || '');
  const updateJob = useUpdateJob();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DBJob>>({});
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    if (job) {
      setEditForm(job);
    }
  }, [job]);

  const startEditing = () => {
    if (job) {
      setEditForm({ ...job });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    if (job) {
      setEditForm({ ...job });
    }
    setIsEditing(false);
  };

  const saveEdits = async () => {
    if (!job) return;
    await updateJob.mutateAsync({
      id: job.id,
      ...editForm,
    });
    setIsEditing(false);
  };

  const updateField = (field: keyof DBJob, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    const currentFeatures = editForm.premium_features || [];
    updateField('premium_features', [...currentFeatures, newFeature.trim()]);
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    const currentFeatures = editForm.premium_features || [];
    updateField('premium_features', currentFeatures.filter((_, i) => i !== index));
  };

  if (!selectedJobId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Job Selected</h2>
            <p className="text-muted-foreground">Select a job from the sidebar to view details</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Job not found</p>
        </div>
      </AppLayout>
    );
  }

  const renderField = (
    label: string,
    field: keyof DBJob,
    type: 'text' | 'number' | 'textarea' | 'select' = 'text',
    options?: { value: string; label: string }[]
  ) => {
    const value = editForm[field] ?? '';
    
    if (!isEditing) {
      return (
        <div className="flex justify-between py-2 border-b last:border-0">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-right">{value || '—'}</span>
        </div>
      );
    }

    if (type === 'select' && options) {
      return (
        <div className="flex justify-between items-center py-2 border-b last:border-0 gap-4">
          <span className="text-muted-foreground shrink-0">{label}</span>
          <Select value={String(value)} onValueChange={(v) => updateField(field, v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div className="py-2 border-b last:border-0">
          <span className="text-muted-foreground block mb-2">{label}</span>
          <Textarea
            value={String(value)}
            onChange={(e) => updateField(field, e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center py-2 border-b last:border-0 gap-4">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <Input
          type={type}
          value={String(value)}
          onChange={(e) => updateField(field, type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          className="w-48 text-right"
        />
      </div>
    );
  };

  const renderDateField = (label: string, field: keyof DBJob) => {
    const value = editForm[field] as string | null;
    
    if (!isEditing) {
      return (
        <div className="flex justify-between py-2 border-b last:border-0">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-right">{formatDate(value)}</span>
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center py-2 border-b last:border-0 gap-4">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => updateField(field, e.target.value || null)}
          className="w-48"
        />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Job Details</h1>
            <p className="text-sm text-muted-foreground">Construction specifications and property information</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={updateJob.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Job
              </Button>
            )}
          </div>
        </div>

        {/* Job Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <Input
                      value={editForm.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="text-xl font-semibold h-10 max-w-md"
                    />
                  ) : (
                    <h2 className="text-xl font-semibold">{job.name}</h2>
                  )}
                  {isEditing ? (
                    <Select value={editForm.status || 'active'} onValueChange={(v) => updateField('status', v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                      {statusOptions.find(s => s.value === job.status)?.label || job.status}
                    </Badge>
                  )}
                </div>
                
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    {isEditing ? (
                      <Input
                        value={editForm.address || ''}
                        onChange={(e) => updateField('address', e.target.value)}
                        placeholder="Property address"
                        className="flex-1"
                      />
                    ) : (
                      <span className="text-muted-foreground">{job.address || '—'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {isEditing ? (
                      <Input
                        value={editForm.client || ''}
                        onChange={(e) => updateField('client', e.target.value)}
                        placeholder="Client name"
                        className="flex-1"
                      />
                    ) : (
                      <span className="text-muted-foreground">{job.client || '—'}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Contract Value</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editForm.contract_amount || ''}
                      onChange={(e) => updateField('contract_amount', Number(e.target.value) || 0)}
                      className="w-40 text-right"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{formatCurrency(job.contract_amount)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completion</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editForm.percent_complete || ''}
                      onChange={(e) => updateField('percent_complete', Number(e.target.value) || 0)}
                      className="w-20 text-right"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-primary">{job.percent_complete}%</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Stats */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Ruler className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editForm.square_footage || ''}
                    onChange={(e) => updateField('square_footage', Number(e.target.value) || null)}
                    className="h-8 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-2xl font-semibold">{job.square_footage?.toLocaleString() || '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">Sq Ft</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bed className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editForm.bedrooms || ''}
                    onChange={(e) => updateField('bedrooms', Number(e.target.value) || null)}
                    className="h-8 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-2xl font-semibold">{job.bedrooms || '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">Bedrooms</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Bath className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      value={editForm.bathrooms || ''}
                      onChange={(e) => updateField('bathrooms', Number(e.target.value) || null)}
                      className="h-8 text-lg font-semibold w-12"
                    />
                    <span>/</span>
                    <Input
                      type="number"
                      value={editForm.half_baths || ''}
                      onChange={(e) => updateField('half_baths', Number(e.target.value) || null)}
                      className="h-8 text-lg font-semibold w-12"
                    />
                  </div>
                ) : (
                  <p className="text-2xl font-semibold">
                    {job.bathrooms || '—'}
                    <span className="text-sm text-muted-foreground">/{job.half_baths || 0}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Full/Half Baths</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Car className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editForm.garage_spaces || ''}
                    onChange={(e) => updateField('garage_spaces', Number(e.target.value) || null)}
                    className="h-8 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-2xl font-semibold">{job.garage_spaces || '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">Car Garage</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Building className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editForm.stories || ''}
                    onChange={(e) => updateField('stories', Number(e.target.value) || null)}
                    className="h-8 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-2xl font-semibold">{job.stories || '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">Stories</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Home className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.lot_size || ''}
                    onChange={(e) => updateField('lot_size', Number(e.target.value) || null)}
                    className="h-8 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-2xl font-semibold">{job.lot_size || '—'}</p>
                )}
                <p className="text-xs text-muted-foreground">Acres</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail Tabs */}
        <Tabs defaultValue="client" className="space-y-4">
          <TabsList>
            <TabsTrigger value="client">Client Info</TabsTrigger>
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="systems">Systems</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="permits">Permits & Legal</TabsTrigger>
          </TabsList>

          <TabsContent value="client">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Client Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderField('Client Name', 'client')}
                  {renderField('Email', 'client_email')}
                  {renderField('Phone', 'client_phone')}
                  {renderField('Cell', 'client_cell')}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Property Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderField('Street Address', 'address')}
                  {renderField('Parcel ID', 'parcel_id')}
                  {renderField('Flood Zone', 'flood_zone')}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="specs">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Structure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderField('Architectural Style', 'architectural_style')}
                  {renderField('Construction Type', 'construction_type')}
                  {renderField('Foundation', 'foundation_type')}
                  {renderField('Roof Type', 'roof_type')}
                  {renderField('Exterior Finish', 'exterior_finish')}
                  {renderField('Year Built', 'year_built', 'number')}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline & Financials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderDateField('Start Date', 'start_date')}
                  {renderDateField('Projected End Date', 'end_date')}
                  {renderDateField('Actual End Date', 'actual_end_date')}
                  {renderField('Budget Amount', 'budget_amount', 'number')}
                  {renderField('Target Margin %', 'target_margin', 'number')}
                  {renderField('Retainage %', 'retainage_percent', 'number')}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="systems">
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Thermometer className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="font-medium">HVAC</span>
                    </div>
                    {isEditing ? (
                      <Input
                        value={editForm.hvac_system || ''}
                        onChange={(e) => updateField('hvac_system', e.target.value)}
                        placeholder="e.g., 2-Zone Trane XR17"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground pl-10">{job.hvac_system || '—'}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-yellow-600" />
                      </div>
                      <span className="font-medium">Electrical</span>
                    </div>
                    {isEditing ? (
                      <Input
                        value={editForm.electrical_service || ''}
                        onChange={(e) => updateField('electrical_service', e.target.value)}
                        placeholder="e.g., 400 AMP Service"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground pl-10">{job.electrical_service || '—'}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Droplets className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium">Plumbing</span>
                    </div>
                    {isEditing ? (
                      <Input
                        value={editForm.plumbing_type || ''}
                        onChange={(e) => updateField('plumbing_type', e.target.value)}
                        placeholder="e.g., PEX with Tankless"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground pl-10">{job.plumbing_type || '—'}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Premium Features & Upgrades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(editForm.premium_features || []).map((feature, i) => (
                    <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm flex items-center gap-1">
                      {feature}
                      {isEditing && (
                        <button onClick={() => removeFeature(i)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {(!editForm.premium_features || editForm.premium_features.length === 0) && !isEditing && (
                    <p className="text-muted-foreground text-sm">No features added</p>
                  )}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Input
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      placeholder="Add a feature..."
                      onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                    />
                    <Button variant="outline" onClick={addFeature}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Project Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editForm.project_manager || ''}
                          onChange={(e) => updateField('project_manager', e.target.value)}
                          placeholder="Project Manager"
                        />
                      ) : (
                        <p className="font-medium">{job.project_manager || 'TBD'}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Project Manager</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Hammer className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editForm.site_supervisor || ''}
                          onChange={(e) => updateField('site_supervisor', e.target.value)}
                          placeholder="Site Supervisor"
                        />
                      ) : (
                        <p className="font-medium">{job.site_supervisor || 'TBD'}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Site Supervisor</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editForm.architect || ''}
                          onChange={(e) => updateField('architect', e.target.value)}
                          placeholder="Architect"
                        />
                      ) : (
                        <p className="font-medium">{job.architect || 'TBD'}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Architect</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editForm.engineer || ''}
                          onChange={(e) => updateField('engineer', e.target.value)}
                          placeholder="Engineer"
                        />
                      ) : (
                        <p className="font-medium">{job.engineer || 'TBD'}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Engineer</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permits">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Permits & Legal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderField('Permit Number', 'permit_number')}
                {renderField('Parcel ID', 'parcel_id')}
                {renderField('Flood Zone', 'flood_zone')}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editForm.notes || ''}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Add notes about this job..."
                    className="min-h-[120px]"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{job.notes || 'No notes'}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default JobDetailsPage;
