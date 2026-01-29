/**
 * DraggableSubgroup
 * Collapsible subgroup containing line items, with add line item button
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
  FileText,
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
import { DraggableLineItemRow } from './DraggableLineItemRow';
import type { DBSubgroup, DBLineItem } from '@/hooks/useEstimateHierarchy';

interface DraggableSubgroupProps {
  subgroup: DBSubgroup;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (itemId: string, data: Partial<DBLineItem>) => void;
  onDeleteLineItem: (itemId: string) => void;
  selectedItems: Set<string>;
  onSelectItem: (itemId: string, checked: boolean) => void;
  disabled?: boolean;
}

export function DraggableSubgroup({
  subgroup,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  selectedItems,
  onSelectItem,
  disabled = false,
}: DraggableSubgroupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(subgroup.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subgroup.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== subgroup.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const lineItemIds = subgroup.items?.map((item) => item.id) || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-background",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Subgroup Header */}
        <div className="flex items-center justify-between py-2 px-3">
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
            <FileText className="h-4 w-4 text-blue-500" />

            {/* Name */}
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') {
                    setEditName(subgroup.name);
                    setIsEditing(false);
                  }
                }}
                className="h-6 w-32 text-sm"
                autoFocus
              />
            ) : (
              <span className="text-sm font-medium">{subgroup.name}</span>
            )}

            {/* Item Count Badge */}
            <Badge variant="outline" className="text-xs">
              {subgroup.items?.length || 0} items
            </Badge>
          </div>

          {/* Right Side: Subtotal + Actions */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">
              {formatCurrencyEstimate(subgroup.subtotal || 0)}
            </span>

            {!disabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddLineItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Line Item
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Subgroup
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Subgroup Content: Line Items */}
        <CollapsibleContent>
          <div className="px-3 pb-2">
            {!subgroup.items || subgroup.items.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border-t">
                <p>No line items</p>
                {!disabled && (
                  <Button variant="link" size="sm" onClick={onAddLineItem}>
                    Add the first line item
                  </Button>
                )}
              </div>
            ) : (
              <div className="border rounded-md">
                {/* Header Row */}
                <div className="grid grid-cols-[auto_auto_1fr_80px_60px_100px_100px_auto] gap-2 items-center p-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div className="w-3" />
                  <div className="w-4" />
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div className="text-center">Unit</div>
                  <div className="text-right">Unit Cost</div>
                  <div className="text-right">Total</div>
                  <div className="w-6" />
                </div>

                {/* Line Items */}
                <SortableContext items={lineItemIds} strategy={verticalListSortingStrategy}>
                  {subgroup.items.map((item) => (
                    <DraggableLineItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      onSelect={(checked) => onSelectItem(item.id, checked)}
                      onUpdate={(data) => onUpdateLineItem(item.id, data)}
                      onDelete={() => onDeleteLineItem(item.id)}
                      disabled={disabled}
                    />
                  ))}
                </SortableContext>

                {/* Add Line Button */}
                {!disabled && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                      onClick={onAddLineItem}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add line item
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
