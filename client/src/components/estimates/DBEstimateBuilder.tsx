/**
 * DBEstimateBuilder
 * Full-featured database-backed estimate builder with drag-and-drop at all hierarchy levels
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ArrowLeft, Plus, Save, Send, Loader2, CheckCircle, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';
import { formatCurrencyEstimate } from '@/types/estimate';
import { DraggablePhase } from './DraggablePhase';
import {
  useEstimateWithHierarchy,
  useCreatePhase,
  useUpdatePhase,
  useDeletePhase,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useCreateSubgroup,
  useUpdateSubgroup,
  useDeleteSubgroup,
  useCreateLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
  useReorderHierarchy,
  useBulkDeleteLineItems,
  useUpdateEstimateSettings,
  DBPhase,
  DBLineItem,
} from '@/hooks/useEstimateHierarchy';
import { useCostCodes } from '@/hooks/useFinancialData';
import { useSubmitDBEstimate, useApproveDBEstimate } from '@/hooks/useDBEstimates';

interface DBEstimateBuilderProps {
  estimateId: string;
  onBack: () => void;
}

export function DBEstimateBuilder({ estimateId, onBack }: DBEstimateBuilderProps) {
  // Data fetching
  const { data: estimate, isLoading, error } = useEstimateWithHierarchy(estimateId);
  const { data: costCodes = [] } = useCostCodes();

  // Mutations
  const createPhase = useCreatePhase(estimateId);
  const updatePhase = useUpdatePhase(estimateId);
  const deletePhase = useDeletePhase(estimateId);
  const createGroup = useCreateGroup(estimateId);
  const updateGroup = useUpdateGroup(estimateId);
  const deleteGroup = useDeleteGroup(estimateId);
  const createSubgroup = useCreateSubgroup(estimateId);
  const updateSubgroup = useUpdateSubgroup(estimateId);
  const deleteSubgroup = useDeleteSubgroup(estimateId);
  const createLineItem = useCreateLineItem(estimateId);
  const updateLineItem = useUpdateLineItem(estimateId);
  const deleteLineItem = useDeleteLineItem(estimateId);
  const reorderHierarchy = useReorderHierarchy(estimateId);
  const bulkDeleteItems = useBulkDeleteLineItems(estimateId);
  const updateSettings = useUpdateEstimateSettings(estimateId);
  const submitEstimate = useSubmitDBEstimate();
  const approveEstimate = useApproveDBEstimate();

  // UI State
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'phase' | 'group' | 'subgroup' | 'item' | 'bulk';
    id?: string;
    name?: string;
  } | null>(null);
  const [lineItemDialog, setLineItemDialog] = useState<{
    subgroupId: string;
    item?: DBLineItem;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Line item form state
  const [newLineForm, setNewLineForm] = useState({
    cost_code_id: '',
    description: '',
    quantity: 1,
    unit: 'EA',
    unit_cost: 0,
    notes: '',
  });

  // Initialize expanded states when estimate loads
  useEffect(() => {
    if (estimate?.phases) {
      const phaseIds = new Set(estimate.phases.map((p) => p.id));
      const groupIds = new Set(
        estimate.phases.flatMap((p) => p.groups?.map((g) => g.id) || [])
      );
      const subgroupIds = new Set(
        estimate.phases.flatMap((p) =>
          p.groups?.flatMap((g) => g.subgroups?.map((sg) => sg.id) || []) || []
        )
      );
      setExpandedPhases(phaseIds);
      setExpandedGroups(groupIds);
      setExpandedSubgroups(subgroupIds);
    }
  }, [estimate?.id]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Toggle helpers
  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const newSet = new Set(set);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    return newSet;
  };

  // Check if estimate is editable
  const isEditable = estimate?.status === 'draft' || estimate?.status === 'rejected';

  // Cost code options for combobox
  const costCodeOptions = useMemo(
    () =>
      costCodes
        .filter((cc) => cc.code && cc.name)
        .map((cc) => ({ value: cc.id, label: `${cc.code} - ${cc.name}` })),
    [costCodes]
  );

  // ============================================================
  // DnD Handlers
  // ============================================================

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !estimate?.phases) return;

    // Determine what type of item is being dragged by finding it in the hierarchy
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Check if it's a phase
    const phaseIndex = estimate.phases.findIndex((p) => p.id === activeIdStr);
    if (phaseIndex !== -1) {
      const newIndex = estimate.phases.findIndex((p) => p.id === overIdStr);
      if (newIndex !== -1) {
        const reordered = arrayMove(estimate.phases, phaseIndex, newIndex);
        const items = reordered.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
        reorderHierarchy.mutate({ type: 'phases', items });
      }
      return;
    }

    // Check if it's a group (search all phases)
    for (const phase of estimate.phases) {
      const groupIndex = phase.groups?.findIndex((g) => g.id === activeIdStr) ?? -1;
      if (groupIndex !== -1 && phase.groups) {
        const newIndex = phase.groups.findIndex((g) => g.id === overIdStr);
        if (newIndex !== -1) {
          const reordered = arrayMove(phase.groups, groupIndex, newIndex);
          const items = reordered.map((g, i) => ({ id: g.id, sort_order: i + 1 }));
          reorderHierarchy.mutate({ type: 'groups', items });
        }
        return;
      }
    }

    // Check if it's a subgroup
    for (const phase of estimate.phases) {
      for (const group of phase.groups || []) {
        const subgroupIndex = group.subgroups?.findIndex((sg) => sg.id === activeIdStr) ?? -1;
        if (subgroupIndex !== -1 && group.subgroups) {
          const newIndex = group.subgroups.findIndex((sg) => sg.id === overIdStr);
          if (newIndex !== -1) {
            const reordered = arrayMove(group.subgroups, subgroupIndex, newIndex);
            const items = reordered.map((sg, i) => ({ id: sg.id, sort_order: i + 1 }));
            reorderHierarchy.mutate({ type: 'subgroups', items });
          }
          return;
        }
      }
    }

    // Check if it's a line item
    for (const phase of estimate.phases) {
      for (const group of phase.groups || []) {
        for (const subgroup of group.subgroups || []) {
          const itemIndex = subgroup.items?.findIndex((i) => i.id === activeIdStr) ?? -1;
          if (itemIndex !== -1 && subgroup.items) {
            const newIndex = subgroup.items.findIndex((i) => i.id === overIdStr);
            if (newIndex !== -1) {
              const reordered = arrayMove(subgroup.items, itemIndex, newIndex);
              const items = reordered.map((item, i) => ({
                id: item.id,
                sort_order: i + 1,
                parent_id: subgroup.id,
              }));
              reorderHierarchy.mutate({ type: 'items', items });
            }
            return;
          }
        }
      }
    }
  };

  // ============================================================
  // CRUD Handlers
  // ============================================================

  const handleAddPhase = () => {
    const count = (estimate?.phases?.length || 0) + 1;
    createPhase.mutate({ name: `Phase ${count}` });
  };

  const handleRenamePhase = (phaseId: string, name: string) => {
    updatePhase.mutate({ phaseId, name });
  };

  const handleDeletePhase = (phaseId: string) => {
    deletePhase.mutate(phaseId);
    setDeleteConfirm(null);
  };

  const handleAddGroup = (phaseId: string) => {
    const phase = estimate?.phases?.find((p) => p.id === phaseId);
    const count = (phase?.groups?.length || 0) + 1;
    createGroup.mutate({ phaseId, name: `Group ${count}` });
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    updateGroup.mutate({ groupId, name });
  };

  const handleDeleteGroup = (groupId: string) => {
    deleteGroup.mutate(groupId);
    setDeleteConfirm(null);
  };

  const handleAddSubgroup = (groupId: string) => {
    let count = 1;
    for (const phase of estimate?.phases || []) {
      const group = phase.groups?.find((g) => g.id === groupId);
      if (group) {
        count = (group.subgroups?.length || 0) + 1;
        break;
      }
    }
    createSubgroup.mutate({ groupId, name: `Subgroup ${count}` });
  };

  const handleRenameSubgroup = (subgroupId: string, name: string) => {
    updateSubgroup.mutate({ subgroupId, name });
  };

  const handleDeleteSubgroup = (subgroupId: string) => {
    deleteSubgroup.mutate(subgroupId);
    setDeleteConfirm(null);
  };

  const handleAddLineItem = (subgroupId: string) => {
    setLineItemDialog({ subgroupId });
    setNewLineForm({
      cost_code_id: '',
      description: '',
      quantity: 1,
      unit: 'EA',
      unit_cost: 0,
      notes: '',
    });
  };

  const handleSaveLineItem = () => {
    if (!lineItemDialog) return;

    if (!newLineForm.description.trim()) {
      toast.error('Description is required');
      return;
    }

    createLineItem.mutate(
      {
        subgroup_id: lineItemDialog.subgroupId,
        cost_code_id: newLineForm.cost_code_id || undefined,
        description: newLineForm.description,
        quantity: newLineForm.quantity,
        unit: newLineForm.unit,
        unit_cost: newLineForm.unit_cost,
        notes: newLineForm.notes || undefined,
      },
      {
        onSuccess: () => {
          setLineItemDialog(null);
          toast.success('Line item added');
        },
      }
    );
  };

  const handleUpdateLineItem = (itemId: string, data: Partial<DBLineItem>) => {
    updateLineItem.mutate({ itemId, ...data });
  };

  const handleDeleteLineItem = (itemId: string) => {
    deleteLineItem.mutate(itemId);
    selectedItems.delete(itemId);
    setSelectedItems(new Set(selectedItems));
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = () => {
    bulkDeleteItems.mutate(Array.from(selectedItems), {
      onSuccess: () => {
        setSelectedItems(new Set());
        setDeleteConfirm(null);
      },
    });
  };

  const handleSubmit = () => {
    submitEstimate.mutate({ id: estimateId, submitted_by: 'Jake Ross' });
  };

  const handleApprove = () => {
    approveEstimate.mutate({ id: estimateId, approved_by: 'Jake Ross' });
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive">Failed to load estimate</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const phaseIds = estimate.phases?.map((p) => p.id) || [];
  const canSubmit = estimate.status === 'draft' && (estimate.phases?.length || 0) > 0;
  const canApprove = estimate.status === 'submitted';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{estimate.title}</h1>
              <p className="text-sm text-muted-foreground">
                {estimate.job?.name || 'No job assigned'}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                estimate.status === 'approved'
                  ? 'border-green-500 text-green-600'
                  : estimate.status === 'submitted'
                  ? 'border-amber-500 text-amber-600'
                  : estimate.status === 'converted'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-gray-400'
              }
            >
              {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && isEditable && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteConfirm({ type: 'bulk' })}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedItems.size} selected
              </Button>
            )}
            <Sheet open={showSettings} onOpenChange={setShowSettings}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-1" /> Settings
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Estimate Settings</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Markup %</Label>
                    <Input
                      type="number"
                      value={estimate.markup_percent || 0}
                      onChange={(e) =>
                        updateSettings.mutate({ markup_percent: parseFloat(e.target.value) || 0 })
                      }
                      disabled={!isEditable}
                    />
                  </div>
                  <div>
                    <Label>Overhead %</Label>
                    <Input
                      type="number"
                      value={estimate.overhead_percent || 0}
                      onChange={(e) =>
                        updateSettings.mutate({ overhead_percent: parseFloat(e.target.value) || 0 })
                      }
                      disabled={!isEditable}
                    />
                  </div>
                  <div>
                    <Label>Profit %</Label>
                    <Input
                      type="number"
                      value={estimate.profit_percent || 0}
                      onChange={(e) =>
                        updateSettings.mutate({ profit_percent: parseFloat(e.target.value) || 0 })
                      }
                      disabled={!isEditable}
                    />
                  </div>
                  <div>
                    <Label>Contingency %</Label>
                    <Input
                      type="number"
                      value={estimate.contingency_percent || 0}
                      onChange={(e) =>
                        updateSettings.mutate({
                          contingency_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            {canSubmit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmit}
                disabled={submitEstimate.isPending}
              >
                {submitEstimate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Submit
              </Button>
            )}
            {canApprove && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approveEstimate.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveEstimate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Builder */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Toolbar */}
          {isEditable && (
            <div className="flex items-center gap-2 mb-4">
              <Button onClick={handleAddPhase} disabled={createPhase.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Add Phase
              </Button>
            </div>
          )}

          {/* Phases */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={phaseIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {!estimate.phases || estimate.phases.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <p>No phases yet</p>
                      {isEditable && (
                        <Button variant="link" onClick={handleAddPhase}>
                          Add your first phase
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  estimate.phases.map((phase) => (
                    <DraggablePhase
                      key={phase.id}
                      phase={phase}
                      isExpanded={expandedPhases.has(phase.id)}
                      onToggle={() => setExpandedPhases((prev) => toggleSet(prev, phase.id))}
                      onRename={(name) => handleRenamePhase(phase.id, name)}
                      onDelete={() =>
                        setDeleteConfirm({ type: 'phase', id: phase.id, name: phase.name })
                      }
                      onAddGroup={() => handleAddGroup(phase.id)}
                      expandedGroups={expandedGroups}
                      onToggleGroup={(gId) => setExpandedGroups((prev) => toggleSet(prev, gId))}
                      onRenameGroup={handleRenameGroup}
                      onDeleteGroup={(gId) => {
                        const group = phase.groups?.find((g) => g.id === gId);
                        setDeleteConfirm({ type: 'group', id: gId, name: group?.name });
                      }}
                      onAddSubgroup={handleAddSubgroup}
                      expandedSubgroups={expandedSubgroups}
                      onToggleSubgroup={(sgId) =>
                        setExpandedSubgroups((prev) => toggleSet(prev, sgId))
                      }
                      onRenameSubgroup={handleRenameSubgroup}
                      onDeleteSubgroup={(sgId) => {
                        let sgName = '';
                        for (const g of phase.groups || []) {
                          const sg = g.subgroups?.find((s) => s.id === sgId);
                          if (sg) {
                            sgName = sg.name;
                            break;
                          }
                        }
                        setDeleteConfirm({ type: 'subgroup', id: sgId, name: sgName });
                      }}
                      onAddLineItem={handleAddLineItem}
                      onUpdateLineItem={handleUpdateLineItem}
                      onDeleteLineItem={handleDeleteLineItem}
                      selectedItems={selectedItems}
                      onSelectItem={handleSelectItem}
                      disabled={!isEditable}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Right Panel: Summary */}
        <div className="w-80 flex-shrink-0 border-l bg-card p-4 overflow-y-auto">
          <h2 className="font-semibold mb-4">Summary</h2>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyEstimate(estimate.subtotal || 0)}
              </span>
            </div>

            {(estimate.markup_percent || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Markup ({estimate.markup_percent}%)
                </span>
                <span className="tabular-nums">
                  {formatCurrencyEstimate(estimate.markup_amount || 0)}
                </span>
              </div>
            )}

            {(estimate.overhead_percent || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Overhead ({estimate.overhead_percent}%)
                </span>
                <span className="tabular-nums">
                  {formatCurrencyEstimate(estimate.overhead_amount || 0)}
                </span>
              </div>
            )}

            {(estimate.profit_percent || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Profit ({estimate.profit_percent}%)
                </span>
                <span className="tabular-nums">
                  {formatCurrencyEstimate(estimate.profit_amount || 0)}
                </span>
              </div>
            )}

            {(estimate.contingency_percent || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Contingency ({estimate.contingency_percent}%)
                </span>
                <span className="tabular-nums">
                  {formatCurrencyEstimate(estimate.contingency_amount || 0)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg text-primary tabular-nums">
                {formatCurrencyEstimate(estimate.total_amount || 0)}
              </span>
            </div>
          </div>

          {/* Phase Breakdown */}
          {estimate.phases && estimate.phases.length > 0 && (
            <>
              <Separator className="my-4" />
              <h3 className="text-sm font-medium mb-3">By Phase</h3>
              <div className="space-y-2">
                {estimate.phases.map((phase) => (
                  <div key={phase.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {phase.name}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrencyEstimate(phase.subtotal || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Quick Stats */}
          <Separator className="my-4" />
          <h3 className="text-sm font-medium mb-3">Statistics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Phases</p>
              <p className="font-medium">{estimate.phases?.length || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Groups</p>
              <p className="font-medium">
                {estimate.phases?.reduce((sum, p) => sum + (p.groups?.length || 0), 0) || 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Subgroups</p>
              <p className="font-medium">
                {estimate.phases?.reduce(
                  (sum, p) =>
                    sum +
                    (p.groups?.reduce((s, g) => s + (g.subgroups?.length || 0), 0) || 0),
                  0
                ) || 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Line Items</p>
              <p className="font-medium">
                {estimate.phases?.reduce(
                  (sum, p) =>
                    sum +
                    (p.groups?.reduce(
                      (s, g) =>
                        s + (g.subgroups?.reduce((ss, sg) => ss + (sg.items?.length || 0), 0) || 0),
                      0
                    ) || 0),
                  0
                ) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === 'bulk'
                ? `Delete ${selectedItems.size} items?`
                : `Delete ${deleteConfirm?.type}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'bulk'
                ? 'This will permanently delete the selected line items.'
                : deleteConfirm?.name
                ? `This will permanently delete "${deleteConfirm.name}" and all its contents.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm?.type === 'bulk') {
                  handleBulkDelete();
                } else if (deleteConfirm?.type === 'phase' && deleteConfirm.id) {
                  handleDeletePhase(deleteConfirm.id);
                } else if (deleteConfirm?.type === 'group' && deleteConfirm.id) {
                  handleDeleteGroup(deleteConfirm.id);
                } else if (deleteConfirm?.type === 'subgroup' && deleteConfirm.id) {
                  handleDeleteSubgroup(deleteConfirm.id);
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Line Item Dialog */}
      <Dialog open={!!lineItemDialog} onOpenChange={() => setLineItemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cost Code (optional)</Label>
              <Combobox
                options={costCodeOptions}
                value={newLineForm.cost_code_id}
                onValueChange={(v) => setNewLineForm({ ...newLineForm, cost_code_id: v })}
                placeholder="Select cost code..."
                searchPlaceholder="Search cost codes..."
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                value={newLineForm.description}
                onChange={(e) => setNewLineForm({ ...newLineForm, description: e.target.value })}
                placeholder="Line item description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={newLineForm.quantity}
                  onChange={(e) =>
                    setNewLineForm({ ...newLineForm, quantity: parseFloat(e.target.value) || 0 })
                  }
                  step="0.01"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={newLineForm.unit}
                  onChange={(e) => setNewLineForm({ ...newLineForm, unit: e.target.value })}
                  placeholder="EA"
                />
              </div>
              <div>
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  value={newLineForm.unit_cost}
                  onChange={(e) =>
                    setNewLineForm({ ...newLineForm, unit_cost: parseFloat(e.target.value) || 0 })
                  }
                  step="0.01"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Amount: {formatCurrencyEstimate(newLineForm.quantity * newLineForm.unit_cost)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineItemDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLineItem} disabled={createLineItem.isPending}>
              {createLineItem.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
