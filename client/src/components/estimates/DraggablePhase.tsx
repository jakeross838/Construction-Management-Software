/**
 * DraggablePhase
 * Top-level collapsible phase with drag handle, subtotal, add group button
 */
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrencyEstimate } from '@/types/estimate';
import { DraggableGroup } from './DraggableGroup';
import type { DBPhase, DBGroup, DBLineItem } from '@/hooks/useEstimateHierarchy';

interface DraggablePhaseProps {
  phase: DBPhase;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddGroup: () => void;
  // Group handlers
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddSubgroup: (groupId: string) => void;
  // Subgroup handlers
  expandedSubgroups: Set<string>;
  onToggleSubgroup: (subgroupId: string) => void;
  onRenameSubgroup: (subgroupId: string, name: string) => void;
  onDeleteSubgroup: (subgroupId: string) => void;
  // Line item handlers
  onAddLineItem: (subgroupId: string) => void;
  onUpdateLineItem: (itemId: string, data: Partial<DBLineItem>) => void;
  onDeleteLineItem: (itemId: string) => void;
  selectedItems: Set<string>;
  onSelectItem: (itemId: string, checked: boolean) => void;
  disabled?: boolean;
}

export function DraggablePhase({
  phase,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  onAddGroup,
  expandedGroups,
  onToggleGroup,
  onRenameGroup,
  onDeleteGroup,
  onAddSubgroup,
  expandedSubgroups,
  onToggleSubgroup,
  onRenameSubgroup,
  onDeleteSubgroup,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  selectedItems,
  onSelectItem,
  disabled = false,
}: DraggablePhaseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(phase.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== phase.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  // Calculate counts
  const groupCount = phase.groups?.length || 0;
  const itemCount = phase.groups?.reduce(
    (sum, g) => sum + (g.subgroups?.reduce((s, sg) => s + (sg.items?.length || 0), 0) || 0),
    0
  ) || 0;

  const groupIds = phase.groups?.map((g) => g.id) || [];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Phase Header */}
        <CardHeader className="py-3 px-4 bg-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className={cn(
                  "cursor-grab active:cursor-grabbing",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Collapse Toggle */}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              {/* Icon */}
              <FolderOpen className="h-4 w-4 text-primary" />

              {/* Name */}
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') {
                      setEditName(phase.name);
                      setIsEditing(false);
                    }
                  }}
                  className="h-7 w-48 font-semibold"
                  autoFocus
                />
              ) : (
                <span className="font-semibold">{phase.name}</span>
              )}

              {/* Phase Code Badge */}
              {phase.phase_code && (
                <Badge variant="outline" className="ml-1 font-mono text-xs">
                  {phase.phase_code}
                </Badge>
              )}

              {/* Counts Badge */}
              <Badge variant="outline" className="ml-2">
                {groupCount} groups / {itemCount} items
              </Badge>
            </div>

            {/* Right Side: Subtotal + Actions */}
            <div className="flex items-center gap-3">
              <span className="font-semibold text-primary tabular-nums">
                {formatCurrencyEstimate(phase.subtotal || 0)}
              </span>

              {!disabled && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddGroup}>
                      <Plus className="mr-2 h-4 w-4" /> Add Group
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Phase
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Phase Content: Groups */}
        <CollapsibleContent>
          <CardContent className="p-3 space-y-2">
            {!phase.groups || phase.groups.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No groups yet</p>
                {!disabled && (
                  <Button variant="link" size="sm" onClick={onAddGroup}>
                    Add the first group
                  </Button>
                )}
              </div>
            ) : (
              <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                {phase.groups.map((group) => (
                  <DraggableGroup
                    key={group.id}
                    group={group}
                    isExpanded={expandedGroups.has(group.id)}
                    onToggle={() => onToggleGroup(group.id)}
                    onRename={(name) => onRenameGroup(group.id, name)}
                    onDelete={() => onDeleteGroup(group.id)}
                    onAddSubgroup={() => onAddSubgroup(group.id)}
                    expandedSubgroups={expandedSubgroups}
                    onToggleSubgroup={onToggleSubgroup}
                    onRenameSubgroup={onRenameSubgroup}
                    onDeleteSubgroup={onDeleteSubgroup}
                    onAddLineItem={onAddLineItem}
                    onUpdateLineItem={onUpdateLineItem}
                    onDeleteLineItem={onDeleteLineItem}
                    selectedItems={selectedItems}
                    onSelectItem={onSelectItem}
                    disabled={disabled}
                  />
                ))}
              </SortableContext>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
