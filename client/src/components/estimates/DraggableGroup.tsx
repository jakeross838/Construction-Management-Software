/**
 * DraggableGroup
 * Collapsible group within phase, contains subgroups, add subgroup button
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
  Folder,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { DraggableSubgroup } from './DraggableSubgroup';
import type { DBGroup, DBSubgroup, DBLineItem } from '@/hooks/useEstimateHierarchy';

interface DraggableGroupProps {
  group: DBGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddSubgroup: () => void;
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

export function DraggableGroup({
  group,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
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
}: DraggableGroupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== group.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const subgroupIds = group.subgroups?.map((sg) => sg.id) || [];
  const totalItems = group.subgroups?.reduce((sum, sg) => sum + (sg.items?.length || 0), 0) || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg bg-muted/30",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Group Header */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className={cn(
                "cursor-grab active:cursor-grabbing",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>

            {/* Collapse Toggle */}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>

            {/* Icon */}
            <Folder className="h-4 w-4 text-amber-500" />

            {/* Name */}
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') {
                    setEditName(group.name);
                    setIsEditing(false);
                  }
                }}
                className="h-6 w-36 text-sm"
                autoFocus
              />
            ) : (
              <span className="font-medium text-sm">{group.name}</span>
            )}

            {/* Counts Badge */}
            <Badge variant="secondary" className="text-xs">
              {group.subgroups?.length || 0} subgroups / {totalItems} items
            </Badge>
          </div>

          {/* Right Side: Subtotal + Actions */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">
              {formatCurrencyEstimate(group.subtotal || 0)}
            </span>

            {!disabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddSubgroup}>
                    <Plus className="mr-2 h-4 w-4" /> Add Subgroup
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Group Content: Subgroups */}
        <CollapsibleContent>
          <div className="p-2 space-y-2">
            {!group.subgroups || group.subgroups.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <p>No subgroups yet</p>
                {!disabled && (
                  <Button variant="link" size="sm" onClick={onAddSubgroup}>
                    Add the first subgroup
                  </Button>
                )}
              </div>
            ) : (
              <SortableContext items={subgroupIds} strategy={verticalListSortingStrategy}>
                {group.subgroups.map((subgroup) => (
                  <DraggableSubgroup
                    key={subgroup.id}
                    subgroup={subgroup}
                    isExpanded={expandedSubgroups.has(subgroup.id)}
                    onToggle={() => onToggleSubgroup(subgroup.id)}
                    onRename={(name) => onRenameSubgroup(subgroup.id, name)}
                    onDelete={() => onDeleteSubgroup(subgroup.id)}
                    onAddLineItem={() => onAddLineItem(subgroup.id)}
                    onUpdateLineItem={onUpdateLineItem}
                    onDeleteLineItem={onDeleteLineItem}
                    selectedItems={selectedItems}
                    onSelectItem={onSelectItem}
                    disabled={disabled}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
