import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCostCode, useUpdateCostCode } from '@/hooks/useCostCodeMutations';
import type { CostCode } from '@/hooks/useCostCodes';

interface CostCodeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCode?: CostCode | null;
  categories: string[];
}

const DEFAULT_CATEGORIES = [
  'Professional Services',
  'Permits & Fees',
  'General Conditions',
  'Surveying',
  'Demolition',
  'Sitework',
  'Pilings',
  'Concrete',
  'Masonry',
  'Framing',
  'Exterior Openings',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Gas',
  'Fireplace',
  'Roofing',
  'Insulation',
  'Drywall',
  'Cabinetry',
  'Appliances',
  'Flooring',
  'Tile & Carpet',
  'Interior Trim',
  'Exterior Finishes',
  'Painting',
  'Garage Doors',
  'Door Hardware',
  'Bath Hardware',
  'Glass',
  'Closet Shelving',
  'Elevator',
  'Exterior Amenities',
  'Landscaping',
  'Pool Decking',
  'Contingency',
  'Equipment',
];

export function CostCodeFormDialog({ open, onOpenChange, costCode, categories }: CostCodeFormDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [createChangeCode, setCreateChangeCode] = useState(false);

  const createMutation = useCreateCostCode();
  const updateMutation = useUpdateCostCode();

  const isEditing = !!costCode;
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort();

  useEffect(() => {
    if (costCode) {
      setCode(costCode.code);
      setName(costCode.name);
      setCategory(costCode.category || '');
      setDescription(costCode.description || '');
      setIsActive(costCode.is_active);
      setCreateChangeCode(false);
    } else {
      setCode('');
      setName('');
      setCategory('');
      setDescription('');
      setIsActive(true);
      setCreateChangeCode(true);
    }
  }, [costCode, open]);

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) return;

    try {
      if (isEditing && costCode) {
        await updateMutation.mutateAsync({
          id: costCode.id,
          code: code.trim(),
          name: name.trim(),
          category: category || null,
          description: description || null,
          is_active: isActive,
        });
      } else {
        // Create base code
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          category: category || null,
          description: description || null,
          is_active: isActive,
        });

        // Optionally create change code version
        if (createChangeCode && !code.trim().endsWith('C')) {
          await createMutation.mutateAsync({
            code: `${code.trim()}C`,
            name: `${name.trim()} - Change`,
            category: category || null,
            description: description ? `${description} (Change Order)` : null,
            is_active: isActive,
          });
        }
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save cost code:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Cost Code' : 'Add Cost Code'}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Save Changes' : 'Create'}
      isSubmitting={isPending}
      submitDisabled={!code.trim() || !name.trim()}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g., 10101"
            className="font-mono"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Framing Labor & General Carpentry"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="active">Active</Label>
        </div>

        {!isEditing && (
          <div className="flex items-center space-x-2">
            <Switch
              id="createChange"
              checked={createChangeCode}
              onCheckedChange={setCreateChangeCode}
            />
            <Label htmlFor="createChange">Also create Change code ({code}C)</Label>
          </div>
        )}
      </div>
    </BaseFormDialog>
  );
}
