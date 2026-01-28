import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Pencil, 
  ChevronDown,
  ChevronRight,
  Package,
  Wrench,
  Users,
  Truck,
  Layers,
  GripVertical,
  FolderOpen,
  Folder,
  FileText,
} from 'lucide-react';
import { 
  EstimateSection, 
  EstimateGroup,
  EstimateSubgroup,
  EstimateLineItem, 
  formatCurrencyEstimate,
  generateId,
  LineItemType,
  lineItemTypes,
} from '@/types/estimate';
import { LineItemForm } from './LineItemForm';
import { BulkActionsBar } from './BulkActionsBar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EnhancedSectionManagerProps {
  sections: EstimateSection[];
  onUpdateSections: (sections: EstimateSection[]) => void;
}

const typeColors: Record<string, string> = {
  material: 'text-blue-500',
  labor: 'text-green-500',
  subcontractor: 'text-purple-500',
  equipment: 'text-amber-500',
  other: 'text-gray-500',
};

type DeleteTarget = {
  type: 'section' | 'group' | 'subgroup' | 'lineItem';
  sectionId: string;
  groupId?: string;
  subgroupId?: string;
  lineItemId?: string;
};

type LineItemDialogState = {
  sectionId: string;
  groupId: string;
  subgroupId: string;
  lineItem?: EstimateLineItem;
} | null;

// Sortable Section Component
function SortableSection({ 
  section, 
  children,
  isExpanded,
  onToggle,
  onEdit,
  onAddGroup,
  onDelete,
}: { 
  section: EstimateSection;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddGroup: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getItemCount = (): number => {
    return section.groups.reduce((sum, g) => 
      sum + g.subgroups.reduce((sum2, sg) => sum2 + sg.lineItems.length, 0), 0
    );
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={cn("overflow-hidden", isDragging && "opacity-50 shadow-lg")}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="py-3 px-4 bg-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-semibold">{section.name}</span>
              <Badge variant="outline" className="ml-2">
                {section.groups.length} groups • {getItemCount()} items
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-primary">
                {formatCurrencyEstimate(section.subtotalWithMarkup)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddGroup}>
                    <Plus className="mr-2 h-4 w-4" /> Add Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-2 space-y-2">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Sortable Line Item Row
function SortableLineItemRow({
  item,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: EstimateLineItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeConfig = lineItemTypes.find(t => t.value === item.type);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_auto_1fr_80px_60px_80px_80px_auto] gap-2 items-center p-2 hover:bg-muted/50 rounded-md group text-sm",
        isSelected && "bg-primary/5",
        isDragging && "opacity-50 bg-muted shadow-md"
      )}
      onDoubleClick={onEdit}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <Checkbox 
        checked={isSelected} 
        onCheckedChange={onSelect}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {typeConfig?.label.slice(0, 3) || 'OTH'}
        </Badge>
        <span className="truncate">{item.description}</span>
      </div>
      <div className="text-right text-muted-foreground">
        {item.quantity.toLocaleString()}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {item.unit}
      </div>
      <div className="text-right">
        {formatCurrencyEstimate(item.unitCost)}
      </div>
      <div className="text-right font-medium text-primary">
        {formatCurrencyEstimate(item.totalWithMarkup)}
      </div>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function EnhancedSectionManager({
  sections,
  onUpdateSections,
}: EnhancedSectionManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);
  const [lineItemDialog, setLineItemDialog] = useState<LineItemDialogState>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const newSet = new Set(set);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    return newSet;
  };

  // Get all line item IDs for bulk selection
  const allLineItemIds = useMemo(() => {
    const ids: string[] = [];
    sections.forEach(s => {
      s.groups.forEach(g => {
        g.subgroups.forEach(sg => {
          sg.lineItems.forEach(li => ids.push(li.id));
        });
      });
    });
    return ids;
  }, [sections]);

  // Section CRUD
  const handleAddSection = () => {
    const newSection: EstimateSection = {
      id: generateId('sec'),
      name: `Section ${sections.length + 1}`,
      groups: [],
      subtotal: 0,
      subtotalWithMarkup: 0,
      sortOrder: sections.length + 1,
    };
    onUpdateSections([...sections, newSection]);
    setExpandedSections(prev => new Set([...prev, newSection.id]));
  };

  const handleAddGroup = (sectionId: string) => {
    const newSections = sections.map(section => {
      if (section.id !== sectionId) return section;
      const newGroup: EstimateGroup = {
        id: generateId('grp'),
        name: `Group ${section.groups.length + 1}`,
        subgroups: [],
        subtotal: 0,
        subtotalWithMarkup: 0,
        sortOrder: section.groups.length + 1,
      };
      setExpandedGroups(prev => new Set([...prev, newGroup.id]));
      return { ...section, groups: [...section.groups, newGroup] };
    });
    onUpdateSections(newSections);
  };

  const handleAddSubgroup = (sectionId: string, groupId: string) => {
    const newSections = sections.map(section => {
      if (section.id !== sectionId) return section;
      const groups = section.groups.map(group => {
        if (group.id !== groupId) return group;
        const newSubgroup: EstimateSubgroup = {
          id: generateId('sub'),
          name: `Subgroup ${group.subgroups.length + 1}`,
          lineItems: [],
          subtotal: 0,
          subtotalWithMarkup: 0,
          sortOrder: group.subgroups.length + 1,
        };
        setExpandedSubgroups(prev => new Set([...prev, newSubgroup.id]));
        return { ...group, subgroups: [...group.subgroups, newSubgroup] };
      });
      return { ...section, groups };
    });
    onUpdateSections(newSections);
  };

  // Edit name handlers
  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const saveEditing = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    const newSections = sections.map(section => {
      if (section.id === editingId) {
        return { ...section, name: editingName.trim() };
      }
      const groups = section.groups.map(group => {
        if (group.id === editingId) {
          return { ...group, name: editingName.trim() };
        }
        const subgroups = group.subgroups.map(subgroup => {
          if (subgroup.id === editingId) {
            return { ...subgroup, name: editingName.trim() };
          }
          return subgroup;
        });
        return { ...group, subgroups };
      });
      return { ...section, groups };
    });

    onUpdateSections(newSections);
    setEditingId(null);
  };

  // Delete handlers
  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;

    let newSections = [...sections];

    if (deleteConfirm.type === 'section') {
      newSections = sections.filter(s => s.id !== deleteConfirm.sectionId);
    } else if (deleteConfirm.type === 'group') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        return { ...section, groups: section.groups.filter(g => g.id !== deleteConfirm.groupId) };
      });
    } else if (deleteConfirm.type === 'subgroup') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        const groups = section.groups.map(group => {
          if (group.id !== deleteConfirm.groupId) return group;
          return { ...group, subgroups: group.subgroups.filter(sg => sg.id !== deleteConfirm.subgroupId) };
        });
        return { ...section, groups };
      });
    } else if (deleteConfirm.type === 'lineItem') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        const groups = section.groups.map(group => {
          if (group.id !== deleteConfirm.groupId) return group;
          const subgroups = group.subgroups.map(subgroup => {
            if (subgroup.id !== deleteConfirm.subgroupId) return subgroup;
            return { ...subgroup, lineItems: subgroup.lineItems.filter(li => li.id !== deleteConfirm.lineItemId) };
          });
          return { ...group, subgroups };
        });
        return { ...section, groups };
      });
    }

    onUpdateSections(newSections);
    setDeleteConfirm(null);
  };

  // Line item handlers
  const handleSaveLineItem = (data: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>) => {
    if (!lineItemDialog) return;

    const newSections = sections.map(section => {
      if (section.id !== lineItemDialog.sectionId) return section;
      const groups = section.groups.map(group => {
        if (group.id !== lineItemDialog.groupId) return group;
        const subgroups = group.subgroups.map(subgroup => {
          if (subgroup.id !== lineItemDialog.subgroupId) return subgroup;
          
          if (lineItemDialog.lineItem) {
            const lineItems = subgroup.lineItems.map(li => 
              li.id === lineItemDialog.lineItem!.id ? { ...li, ...data } : li
            );
            return { ...subgroup, lineItems };
          } else {
            const newItem: EstimateLineItem = {
              ...data,
              id: generateId('li'),
              sortOrder: subgroup.lineItems.length + 1,
              totalCost: data.quantity * data.unitCost,
              totalWithMarkup: 0,
            };
            return { ...subgroup, lineItems: [...subgroup.lineItems, newItem] };
          }
        });
        return { ...group, subgroups };
      });
      return { ...section, groups };
    });

    onUpdateSections(newSections);
  };

  // Drag handlers for sections
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = arrayMove(sections, oldIndex, newIndex);
        onUpdateSections(newSections);
      }
    }
  };

  // Bulk action handlers
  const handleBulkDelete = () => {
    const newSections = sections.map(section => ({
      ...section,
      groups: section.groups.map(group => ({
        ...group,
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          lineItems: subgroup.lineItems.filter(li => !selectedItems.has(li.id)),
        })),
      })),
    }));
    onUpdateSections(newSections);
    setSelectedItems(new Set());
    toast.success(`Deleted ${selectedItems.size} items`);
  };

  const handleBulkApplyMarkup = (markup: number) => {
    const newSections = sections.map(section => ({
      ...section,
      groups: section.groups.map(group => ({
        ...group,
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          lineItems: subgroup.lineItems.map(li => 
            selectedItems.has(li.id) ? { ...li, markup } : li
          ),
        })),
      })),
    }));
    onUpdateSections(newSections);
    toast.success(`Applied ${markup}% markup to ${selectedItems.size} items`);
  };

  const handleBulkChangeType = (type: LineItemType) => {
    const newSections = sections.map(section => ({
      ...section,
      groups: section.groups.map(group => ({
        ...group,
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          lineItems: subgroup.lineItems.map(li => 
            selectedItems.has(li.id) ? { ...li, type } : li
          ),
        })),
      })),
    }));
    onUpdateSections(newSections);
    toast.success(`Changed type for ${selectedItems.size} items`);
  };

  const handleBulkMoveToSection = (targetSectionId: string) => {
    // Collect selected items
    const itemsToMove: EstimateLineItem[] = [];
    sections.forEach(s => {
      s.groups.forEach(g => {
        g.subgroups.forEach(sg => {
          sg.lineItems.forEach(li => {
            if (selectedItems.has(li.id)) itemsToMove.push(li);
          });
        });
      });
    });

    // Remove from original locations and add to target section's first group/subgroup
    const newSections = sections.map(section => {
      const groups = section.groups.map(group => ({
        ...group,
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          lineItems: subgroup.lineItems.filter(li => !selectedItems.has(li.id)),
        })),
      }));

      if (section.id === targetSectionId) {
        // Add to first subgroup of first group, creating if necessary
        if (groups.length === 0) {
          const newSubgroup: EstimateSubgroup = {
            id: generateId('sub'),
            name: 'General',
            lineItems: itemsToMove,
            subtotal: 0,
            subtotalWithMarkup: 0,
            sortOrder: 1,
          };
          const newGroup: EstimateGroup = {
            id: generateId('grp'),
            name: 'General',
            subgroups: [newSubgroup],
            subtotal: 0,
            subtotalWithMarkup: 0,
            sortOrder: 1,
          };
          return { ...section, groups: [newGroup] };
        } else if (groups[0].subgroups.length === 0) {
          groups[0].subgroups = [{
            id: generateId('sub'),
            name: 'General',
            lineItems: itemsToMove,
            subtotal: 0,
            subtotalWithMarkup: 0,
            sortOrder: 1,
          }];
        } else {
          groups[0].subgroups[0].lineItems = [...groups[0].subgroups[0].lineItems, ...itemsToMove];
        }
      }

      return { ...section, groups };
    });

    onUpdateSections(newSections);
    setSelectedItems(new Set());
    toast.success(`Moved ${itemsToMove.length} items`);
  };

  const sectionIds = sections.map(s => s.id);

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => setExpandedSections(prev => toggleSet(prev, section.id))}
              onEdit={() => startEditing(section.id, section.name)}
              onAddGroup={() => handleAddGroup(section.id)}
              onDelete={() => setDeleteConfirm({ type: 'section', sectionId: section.id })}
            >
              {section.groups.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No groups yet</p>
                  <Button variant="link" size="sm" onClick={() => handleAddGroup(section.id)}>
                    Add the first group
                  </Button>
                </div>
              ) : (
                section.groups.map((group) => (
                  <Collapsible
                    key={group.id}
                    open={expandedGroups.has(group.id)}
                    onOpenChange={() => setExpandedGroups(prev => toggleSet(prev, group.id))}
                  >
                    <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            {expandedGroups.has(group.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        </CollapsibleTrigger>
                        <Folder className="h-4 w-4 text-amber-500" />
                        {editingId === group.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                            className="h-6 w-36 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-sm">{group.name}</span>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {group.subgroups.length} subgroups
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatCurrencyEstimate(group.subtotalWithMarkup)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEditing(group.id, group.name)}>
                              <Pencil className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddSubgroup(section.id, group.id)}>
                              <Plus className="mr-2 h-4 w-4" /> Add Subgroup
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeleteConfirm({ type: 'group', sectionId: section.id, groupId: group.id })}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2">
                        {group.subgroups.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            <p>No subgroups yet</p>
                            <Button variant="link" size="sm" onClick={() => handleAddSubgroup(section.id, group.id)}>
                              Add the first subgroup
                            </Button>
                          </div>
                        ) : (
                          group.subgroups.map((subgroup) => (
                            <Collapsible
                              key={subgroup.id}
                              open={expandedSubgroups.has(subgroup.id)}
                              onOpenChange={() => setExpandedSubgroups(prev => toggleSet(prev, subgroup.id))}
                            >
                              <div className="flex items-center justify-between py-2 px-3 bg-background border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5">
                                      {expandedSubgroups.has(subgroup.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  {editingId === subgroup.id ? (
                                    <Input
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onBlur={saveEditing}
                                      onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                      className="h-6 w-32 text-sm"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="text-sm">{subgroup.name}</span>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {subgroup.lineItems.length} items
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{formatCurrencyEstimate(subgroup.subtotalWithMarkup)}</span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => startEditing(subgroup.id, subgroup.name)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setLineItemDialog({ sectionId: section.id, groupId: group.id, subgroupId: subgroup.id })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Line Item
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => setDeleteConfirm({ type: 'subgroup', sectionId: section.id, groupId: group.id, subgroupId: subgroup.id })}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Subgroup
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              <CollapsibleContent>
                                <div className="ml-4 mt-2 border rounded-lg">
                                  {subgroup.lineItems.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                      <p>No line items</p>
                                      <Button variant="link" size="sm" onClick={() => setLineItemDialog({ sectionId: section.id, groupId: group.id, subgroupId: subgroup.id })}>
                                        Add the first line item
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="divide-y">
                                      {/* Header */}
                                      <div className="grid grid-cols-[auto_auto_1fr_80px_60px_80px_80px_auto] gap-2 items-center p-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                                        <div className="w-3" />
                                        <div className="w-4" />
                                        <div>Description</div>
                                        <div className="text-right">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-right">Unit Cost</div>
                                        <div className="text-right">Total</div>
                                        <div className="w-6" />
                                      </div>
                                      {/* Items */}
                                      <SortableContext items={subgroup.lineItems.map(li => li.id)} strategy={verticalListSortingStrategy}>
                                        {subgroup.lineItems.map((item) => (
                                          <SortableLineItemRow
                                            key={item.id}
                                            item={item}
                                            isSelected={selectedItems.has(item.id)}
                                            onSelect={(checked) => {
                                              setSelectedItems(prev => {
                                                const newSet = new Set(prev);
                                                if (checked) newSet.add(item.id);
                                                else newSet.delete(item.id);
                                                return newSet;
                                              });
                                            }}
                                            onEdit={() => setLineItemDialog({ sectionId: section.id, groupId: group.id, subgroupId: subgroup.id, lineItem: item })}
                                            onDelete={() => setDeleteConfirm({ type: 'lineItem', sectionId: section.id, groupId: group.id, subgroupId: subgroup.id, lineItemId: item.id })}
                                          />
                                        ))}
                                      </SortableContext>
                                      {/* Add button */}
                                      <div className="p-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="w-full justify-start text-muted-foreground"
                                          onClick={() => setLineItemDialog({ sectionId: section.id, groupId: group.id, subgroupId: subgroup.id })}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add line item
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </SortableSection>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add Section Button */}
      <Button variant="outline" className="w-full" onClick={handleAddSection}>
        <Plus className="mr-2 h-4 w-4" />
        Add Section
      </Button>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedItems.size}
        onClearSelection={() => setSelectedItems(new Set())}
        onDelete={handleBulkDelete}
        onApplyMarkup={handleBulkApplyMarkup}
        onChangeType={handleBulkChangeType}
        onMoveToSection={handleBulkMoveToSection}
        sections={sections.map(s => ({ id: s.id, name: s.name }))}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteConfirm?.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Line Item Form Dialog */}
      {lineItemDialog && (
        <LineItemForm
          open={!!lineItemDialog}
          onOpenChange={(open) => !open && setLineItemDialog(null)}
          lineItem={lineItemDialog.lineItem}
          onSave={(data) => {
            handleSaveLineItem(data);
            setLineItemDialog(null);
          }}
        />
      )}
    </div>
  );
}
