import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, LayoutTemplate, ChevronDown } from 'lucide-react';
import { useJobs } from '@/hooks/useJobs';
import {
  useCreateBidPackage,
  useUpdateBidPackage,
  generatePackageNumber,
  TRADE_CATEGORIES,
  BidPackage,
  useSuggestTradeCategory,
  useBidPackageTemplates,
  useApplyBidPackageTemplate,
} from '@/hooks/useBidPackages';
import { useJob } from '@/contexts/JobContext';

interface BidPackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPackage?: BidPackage | null;
}

export function BidPackageFormDialog({
  open,
  onOpenChange,
  editPackage,
}: BidPackageFormDialogProps) {
  const { selectedJobId } = useJob();
  const { data: jobs = [] } = useJobs();
  const { data: templates = [] } = useBidPackageTemplates();
  const createPackage = useCreateBidPackage();
  const updatePackage = useUpdateBidPackage();
  const suggestTrade = useSuggestTradeCategory();
  const applyTemplate = useApplyBidPackageTemplate();
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number; reasoning: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [formData, setFormData] = useState({
    package_number: '',
    title: '',
    description: '',
    trade_category: '',
    scope_of_work: '',
    job_id: '',
    due_date: '',
    issue_date: '',
    site_visit_date: '',
    site_visit_time: '',
    square_footage: '',
    specs_summary: '',
    special_requirements: '',
  });

  useEffect(() => {
    if (open) {
      if (editPackage) {
        setFormData({
          package_number: editPackage.package_number,
          title: editPackage.title,
          description: editPackage.description || '',
          trade_category: editPackage.trade_category,
          scope_of_work: editPackage.scope_of_work || '',
          job_id: editPackage.job_id || '',
          due_date: editPackage.due_date?.split('T')[0] || '',
          issue_date: editPackage.issue_date?.split('T')[0] || '',
          site_visit_date: editPackage.site_visit_date?.split('T')[0] || '',
          site_visit_time: editPackage.site_visit_time || '',
          square_footage: editPackage.square_footage?.toString() || '',
          specs_summary: editPackage.specs_summary || '',
          special_requirements: editPackage.special_requirements || '',
        });
      } else {
        generatePackageNumber().then((num) => {
          setFormData({
            package_number: num,
            title: '',
            description: '',
            trade_category: '',
            scope_of_work: '',
            job_id: selectedJobId || '',
            due_date: '',
            issue_date: new Date().toISOString().split('T')[0],
            site_visit_date: '',
            site_visit_time: '',
            square_footage: '',
            specs_summary: '',
            special_requirements: '',
          });
        });
      }
    }
  }, [open, editPackage, selectedJobId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      package_number: formData.package_number,
      title: formData.title,
      description: formData.description || null,
      trade_category: formData.trade_category,
      scope_of_work: formData.scope_of_work || null,
      job_id: formData.job_id || null,
      due_date: formData.due_date,
      issue_date: formData.issue_date || null,
      site_visit_date: formData.site_visit_date || null,
      site_visit_time: formData.site_visit_time || null,
      square_footage: formData.square_footage ? parseFloat(formData.square_footage) : null,
      specs_summary: formData.specs_summary || null,
      special_requirements: formData.special_requirements || null,
    };

    if (editPackage) {
      updatePackage.mutate(
        { id: editPackage.id, ...payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createPackage.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = createPackage.isPending || updatePackage.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editPackage ? 'Edit Bid Package' : 'Create Bid Package'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Selector - only show when creating new */}
          {!editPackage && templates.length > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LayoutTemplate className="h-4 w-4 text-primary" />
                Start from Template
              </div>
              <div className="flex gap-2">
                <Select
                  value={selectedTemplate}
                  onValueChange={(templateId) => {
                    setSelectedTemplate(templateId);
                    if (templateId) {
                      applyTemplate.mutate(templateId, {
                        onSuccess: (data) => {
                          setFormData((prev) => ({
                            ...prev,
                            trade_category: data.trade_category || prev.trade_category,
                            scope_of_work: data.scope_of_work || prev.scope_of_work,
                            description: data.description || prev.description,
                            specs_summary: data.specs_summary || prev.specs_summary,
                            special_requirements: data.special_requirements || prev.special_requirements,
                            square_footage: data.square_footage?.toString() || prev.square_footage,
                          }));
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a template to auto-fill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {tpl.trade_category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTemplate('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {applyTemplate.isPending && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Applying template...
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="package_number">Package Number</Label>
              <Input
                id="package_number"
                value={formData.package_number}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, package_number: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_id">Job</Label>
              <Select
                value={formData.job_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, job_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job" />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g., Framing Package, Electrical Rough-In"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="trade_category">Trade Category *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  disabled={!formData.title || suggestTrade.isPending}
                  onClick={() => {
                    suggestTrade.mutate(
                      {
                        title: formData.title,
                        description: formData.description,
                        scope_of_work: formData.scope_of_work
                      },
                      {
                        onSuccess: (data) => {
                          setFormData((p) => ({ ...p, trade_category: data.suggestion }));
                          setAiSuggestion({
                            category: data.suggestion,
                            confidence: data.confidence,
                            reasoning: data.reasoning
                          });
                        }
                      }
                    );
                  }}
                >
                  {suggestTrade.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Auto-detect
                </Button>
              </div>
              <Select
                value={formData.trade_category}
                onValueChange={(v) => {
                  setFormData((p) => ({ ...p, trade_category: v }));
                  setAiSuggestion(null);
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {aiSuggestion && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    AI: {Math.round(aiSuggestion.confidence * 100)}% confident
                  </Badge>
                  <span className="text-muted-foreground">{aiSuggestion.reasoning}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="square_footage">Square Footage</Label>
              <Input
                id="square_footage"
                type="number"
                value={formData.square_footage}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, square_footage: e.target.value }))
                }
                placeholder="4500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Brief overview of this bid package..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope_of_work">Scope of Work</Label>
            <Textarea
              id="scope_of_work"
              value={formData.scope_of_work}
              onChange={(e) =>
                setFormData((p) => ({ ...p, scope_of_work: e.target.value }))
              }
              placeholder="Detailed scope of work for subcontractors..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, issue_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, due_date: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_visit_date">Site Visit Date</Label>
              <Input
                id="site_visit_date"
                type="date"
                value={formData.site_visit_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, site_visit_date: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specs_summary">Specifications Summary</Label>
            <Textarea
              id="specs_summary"
              value={formData.specs_summary}
              onChange={(e) =>
                setFormData((p) => ({ ...p, specs_summary: e.target.value }))
              }
              placeholder="Key specs and requirements..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_requirements">Special Requirements</Label>
            <Textarea
              id="special_requirements"
              value={formData.special_requirements}
              onChange={(e) =>
                setFormData((p) => ({ ...p, special_requirements: e.target.value }))
              }
              placeholder="Insurance requirements, bonding, certifications..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editPackage ? 'Update Package' : 'Create Package'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
