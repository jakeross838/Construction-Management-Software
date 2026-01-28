import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Estimate } from '@/types/estimate';
import { useCreateTemplate, estimateToTemplate, useTemplateCategories } from '@/hooks/useEstimateTemplates';
import { Layers } from 'lucide-react';

interface SaveAsTemplateDialogProps {
  estimate: Estimate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultCategories = [
  'General',
  'New Construction',
  'Remodel',
  'Kitchen',
  'Bath',
  'Addition',
  'Renovation',
  'Commercial',
];

export function SaveAsTemplateDialog({ estimate, open, onOpenChange }: SaveAsTemplateDialogProps) {
  const createTemplate = useCreateTemplate();
  const existingCategories = useTemplateCategories();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const categories = [...new Set([...defaultCategories, ...existingCategories])];

  const handleSave = async () => {
    if (!estimate || !name.trim()) return;

    const finalCategory = category === '_custom' ? customCategory.trim() : category;
    
    const templateData = estimateToTemplate(estimate, name.trim(), finalCategory || 'General');
    templateData.description = description.trim() || templateData.description;
    templateData.is_default = isDefault;

    await createTemplate.mutateAsync(templateData);
    
    // Reset form
    setName('');
    setDescription('');
    setCategory('General');
    setCustomCategory('');
    setIsDefault(false);
    onOpenChange(false);
  };

  // Pre-fill when estimate changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && estimate) {
      setName(`${estimate.projectType.replace('_', ' ')} Template`);
      setDescription(estimate.projectDescription || '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this estimate as a reusable template. You can start new estimates from this template later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard New Construction"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe when to use this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="_custom">+ Custom Category</SelectItem>
              </SelectContent>
            </Select>
            {category === '_custom' && (
              <Input
                placeholder="Enter custom category..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="is-default" className="text-sm font-normal">
              Set as default template (pre-selected when creating new estimates)
            </Label>
          </div>

          {estimate && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Template will include:</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• {estimate.sections.length} sections with all line items</li>
                <li>• Markup settings ({estimate.markupSettings.overheadPercent}% OH, {estimate.markupSettings.profitPercent}% profit)</li>
                <li>• {estimate.exclusions.length} exclusions, {estimate.clarifications.length} clarifications</li>
                {estimate.termsAndConditions && <li>• Terms & conditions</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || createTemplate.isPending}>
            {createTemplate.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
