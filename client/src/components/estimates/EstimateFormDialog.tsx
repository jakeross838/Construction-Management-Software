import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building2, Settings2 } from 'lucide-react';
import { Estimate, projectTypes, defaultMarkupSettings, EstimateMarkupSettings } from '@/types/estimate';
import { useJobs, type Job as DBJob } from '@/hooks/useJobs';
import { useJob as useJobContext } from '@/contexts/JobContext';

interface EstimateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate?: Estimate | null;
  onSave: (data: Partial<Estimate>) => void;
  leadData?: {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    projectName?: string;
    projectDescription?: string;
  };
  selectedJob?: DBJob | null;
}

export function EstimateFormDialog({ 
  open, 
  onOpenChange, 
  estimate, 
  onSave,
  leadData,
  selectedJob,
}: EstimateFormDialogProps) {
  const isEditing = !!estimate;

  const { data: jobs = [] } = useJobs();
  const { selectedJobId: contextJobId } = useJobContext();
  
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    projectName: '',
    projectAddress: '',
    projectDescription: '',
    projectSquareFeet: '',
    projectType: 'new_construction' as Estimate['projectType'],
  });

  const [markupSettings, setMarkupSettings] = useState<EstimateMarkupSettings>({ ...defaultMarkupSettings });

  // Create job options for combobox
  const jobOptions = jobs.map(job => ({
    value: job.id,
    label: job.name,
    description: job.client || job.address,
  }));

  // Create project type options for combobox
  const projectTypeOptions = projectTypes.map(type => ({
    value: type.value,
    label: type.label,
  }));

  // When a job is selected, pre-fill form data
  useEffect(() => {
    if (selectedJobId) {
      const job = jobs.find(j => j.id === selectedJobId);
      if (job) {
        setFormData(prev => ({
          ...prev,
          clientName: job.client || prev.clientName,
          projectName: job.name || prev.projectName,
          projectAddress: job.address || prev.projectAddress,
        }));
      }
    }
  }, [selectedJobId, jobs]);

  useEffect(() => {
    if (estimate) {
      setFormData({
        clientName: estimate.clientName,
        clientEmail: estimate.clientEmail || '',
        clientPhone: estimate.clientPhone || '',
        clientAddress: estimate.clientAddress || '',
        projectName: estimate.projectName,
        projectAddress: estimate.projectAddress || '',
        projectDescription: estimate.projectDescription,
        projectSquareFeet: estimate.projectSquareFeet?.toString() || '',
        projectType: estimate.projectType,
      });
      setMarkupSettings(estimate.markupSettings);
      setSelectedJobId(estimate.jobId || '');
    } else if (selectedJob) {
      // Pre-fill from selected job context
      setFormData({
        clientName: selectedJob.client || '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        projectName: selectedJob.name || '',
        projectAddress: selectedJob.address || '',
        projectDescription: '',
        projectSquareFeet: '',
        projectType: 'new_construction',
      });
      setMarkupSettings({ ...defaultMarkupSettings });
      setSelectedJobId(selectedJob.id);
    } else if (contextJobId) {
      // If a job is selected in the global sidebar, inherit it and don't prompt again.
      setSelectedJobId(contextJobId);
    } else if (leadData) {
      setFormData(prev => ({
        ...prev,
        clientName: leadData.clientName || '',
        clientEmail: leadData.clientEmail || '',
        clientPhone: leadData.clientPhone || '',
        projectName: leadData.projectName || '',
        projectDescription: leadData.projectDescription || '',
      }));
      setSelectedJobId('');
    } else {
      setFormData({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        projectName: '',
        projectAddress: '',
        projectDescription: '',
        projectSquareFeet: '',
        projectType: 'new_construction',
      });
      setMarkupSettings({ ...defaultMarkupSettings });
      setSelectedJobId('');
    }
  }, [estimate, leadData, selectedJob, open, contextJobId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      projectSquareFeet: formData.projectSquareFeet ? parseInt(formData.projectSquareFeet) : undefined,
      markupSettings,
      jobId: selectedJob?.id || contextJobId || selectedJobId || undefined,
    });
    onOpenChange(false);
  };

  const showJobSelector = !selectedJob && !contextJobId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Estimate' : 'Create New Estimate'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="client" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Client
              </TabsTrigger>
              <TabsTrigger value="project" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Project
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Markup Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="space-y-4 mt-4">
              {/* Job selector - only shown when no job is pre-selected */}
              {showJobSelector && (
                <div className="space-y-2">
                  <Label>Link to Job</Label>
                  <Combobox
                    options={jobOptions}
                    value={selectedJobId}
                    onValueChange={setSelectedJobId}
                    placeholder="Select a job..."
                    searchPlaceholder="Search jobs..."
                    emptyText="No jobs found."
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecting a job will pre-fill client and project information
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="John & Jane Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="client@email.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone</Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientAddress">Client Address</Label>
                  <Input
                    id="clientAddress"
                    value={formData.clientAddress}
                    onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                    placeholder="123 Main St, City, State ZIP"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="project" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name *</Label>
                  <Input
                    id="projectName"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="Smith Residence"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectType">Project Type</Label>
                  <Combobox
                    options={projectTypeOptions}
                    value={formData.projectType}
                    onValueChange={(v) => setFormData({ ...formData, projectType: v as Estimate['projectType'] })}
                    placeholder="Select project type..."
                    searchPlaceholder="Search types..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectAddress">Project Address</Label>
                  <Input
                    id="projectAddress"
                    value={formData.projectAddress}
                    onChange={(e) => setFormData({ ...formData, projectAddress: e.target.value })}
                    placeholder="456 Project Lane, City, State ZIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectSquareFeet">Square Feet</Label>
                  <Input
                    id="projectSquareFeet"
                    type="number"
                    value={formData.projectSquareFeet}
                    onChange={(e) => setFormData({ ...formData, projectSquareFeet: e.target.value })}
                    placeholder="2500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectDescription">Project Description</Label>
                <Textarea
                  id="projectDescription"
                  value={formData.projectDescription}
                  onChange={(e) => setFormData({ ...formData, projectDescription: e.target.value })}
                  placeholder="Describe the scope of work..."
                  rows={4}
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cost Type Markups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="materialMarkup">Material %</Label>
                      <Input
                        id="materialMarkup"
                        type="number"
                        value={markupSettings.materialMarkup}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, materialMarkup: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="laborMarkup">Labor %</Label>
                      <Input
                        id="laborMarkup"
                        type="number"
                        value={markupSettings.laborMarkup}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, laborMarkup: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subcontractorMarkup">Subcontractor %</Label>
                      <Input
                        id="subcontractorMarkup"
                        type="number"
                        value={markupSettings.subcontractorMarkup}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, subcontractorMarkup: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipmentMarkup">Equipment %</Label>
                      <Input
                        id="equipmentMarkup"
                        type="number"
                        value={markupSettings.equipmentMarkup}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, equipmentMarkup: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Overhead, Profit & Contingency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="overheadPercent">Overhead %</Label>
                      <Input
                        id="overheadPercent"
                        type="number"
                        value={markupSettings.overheadPercent}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, overheadPercent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profitPercent">Profit %</Label>
                      <Input
                        id="profitPercent"
                        type="number"
                        value={markupSettings.profitPercent}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, profitPercent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contingencyPercent">Contingency %</Label>
                      <Input
                        id="contingencyPercent"
                        type="number"
                        value={markupSettings.contingencyPercent}
                        onChange={(e) => setMarkupSettings({ ...markupSettings, contingencyPercent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Save Changes' : 'Create & Continue to Builder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
