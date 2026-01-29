/**
 * DraggableLineItemRow
 * Individual line item with inline editing, checkbox for bulk select, drag handle
 */
import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, MoreHorizontal, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrencyEstimate } from '@/types/estimate';
import type { DBLineItem } from '@/hooks/useEstimateHierarchy';

interface DraggableLineItemRowProps {
  item: DBLineItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onUpdate: (data: Partial<DBLineItem>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function DraggableLineItemRow({
  item,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  disabled = false,
}: DraggableLineItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unit_cost,
  });
  const descRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Focus description input when entering edit mode
  useEffect(() => {
    if (isEditing && descRef.current) {
      descRef.current.focus();
      descRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const qty = parseFloat(String(editData.quantity)) || 1;
    const cost = parseFloat(String(editData.unit_cost)) || 0;
    onUpdate({
      description: editData.description,
      quantity: qty,
      unit: editData.unit,
      unit_cost: cost,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const amount = item.quantity * item.unit_cost;
  const amountWithMarkup = amount * (1 + (item.markup_percent || 0) / 100);

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="grid grid-cols-[auto_auto_1fr_80px_60px_100px_100px_auto] gap-2 items-center p-2 bg-muted/30 rounded-md border border-primary/30"
      >
        <div className="w-4" />
        <div className="w-4" />
        <Input
          ref={descRef}
          value={editData.description}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm"
          placeholder="Description"
        />
        <Input
          type="number"
          value={editData.quantity}
          onChange={(e) => setEditData({ ...editData, quantity: parseFloat(e.target.value) || 0 })}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm text-right"
          step="0.01"
        />
        <Input
          value={editData.unit}
          onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm text-center"
          placeholder="Unit"
        />
        <Input
          type="number"
          value={editData.unit_cost}
          onChange={(e) => setEditData({ ...editData, unit_cost: parseFloat(e.target.value) || 0 })}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm text-right"
          step="0.01"
        />
        <div className="text-right text-sm font-medium text-muted-foreground">
          {formatCurrencyEstimate(
            (parseFloat(String(editData.quantity)) || 0) *
            (parseFloat(String(editData.unit_cost)) || 0)
          )}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_auto_1fr_80px_60px_100px_100px_auto] gap-2 items-center p-2 hover:bg-muted/50 rounded-md group text-sm",
        isSelected && "bg-primary/5",
        isDragging && "opacity-50 bg-muted shadow-md z-50"
      )}
      onDoubleClick={() => !disabled && setIsEditing(true)}
    >
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

      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
      />

      {/* Description + Cost Code */}
      <div className="flex items-center gap-2 min-w-0">
        {item.cost_code && (
          <Badge variant="outline" className="text-xs flex-shrink-0 font-mono">
            {item.cost_code.code}
          </Badge>
        )}
        <span className="truncate">{item.description}</span>
      </div>

      {/* Quantity */}
      <div className="text-right text-muted-foreground tabular-nums">
        {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>

      {/* Unit */}
      <div className="text-center text-xs text-muted-foreground uppercase">
        {item.unit}
      </div>

      {/* Unit Cost */}
      <div className="text-right tabular-nums">
        {formatCurrencyEstimate(item.unit_cost)}
      </div>

      {/* Total */}
      <div className="text-right font-medium text-primary tabular-nums">
        {formatCurrencyEstimate(amount)}
      </div>

      {/* Actions */}
      <div className="flex items-center">
        {!disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
