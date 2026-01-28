import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical, Trash2, X, Check } from 'lucide-react';
import { 
  EstimateLineItem, 
  LineItemType,
  MarkupType,
  lineItemTypes, 
  commonUnits,
  formatCurrencyEstimate,
} from '@/types/estimate';
import { cn } from '@/lib/utils';

interface DraggableLineItemProps {
  item: EstimateLineItem;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (updates: Partial<EstimateLineItem>) => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function DraggableLineItem({
  item,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  isDragging,
  dragHandleProps,
}: DraggableLineItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    type: item.type,
    markup: item.markup,
  });

  const typeConfig = lineItemTypes.find(t => t.value === item.type);

  const handleDoubleClick = () => {
    setEditValues({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      type: item.type,
      markup: item.markup,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const quantity = parseFloat(String(editValues.quantity)) || 0;
    const unitCost = parseFloat(String(editValues.unitCost)) || 0;
    const markup = parseFloat(String(editValues.markup)) || 0;
    const totalCost = quantity * unitCost;
    const markupAmount = item.markupType === 'percentage' ? totalCost * (markup / 100) : markup;
    const totalWithMarkup = totalCost + markupAmount;

    onUpdate({
      description: editValues.description,
      quantity,
      unit: editValues.unit,
      unitCost,
      type: editValues.type,
      markup,
      totalCost,
      totalWithMarkup,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div 
        className={cn(
          "grid grid-cols-[auto_auto_1fr_80px_60px_80px_60px_80px_80px_auto] gap-2 items-center p-2 bg-primary/5 border border-primary rounded-md",
          isDragging && "opacity-50"
        )}
        onKeyDown={handleKeyDown}
      >
        <div className="w-6" />
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
        <Input
          value={editValues.description}
          onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
          className="h-8 text-sm"
          autoFocus
        />
        <Input
          type="number"
          value={editValues.quantity}
          onChange={(e) => setEditValues(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
          className="h-8 text-sm text-right"
        />
        <Select value={editValues.unit} onValueChange={(v) => setEditValues(prev => ({ ...prev, unit: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {commonUnits.map(u => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={editValues.unitCost}
          onChange={(e) => setEditValues(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
          className="h-8 text-sm text-right"
        />
        <Select value={editValues.type} onValueChange={(v) => setEditValues(prev => ({ ...prev, type: v as LineItemType }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lineItemTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={editValues.markup}
          onChange={(e) => setEditValues(prev => ({ ...prev, markup: parseFloat(e.target.value) || 0 }))}
          className="h-8 text-sm text-right"
        />
        <div className="text-right font-medium text-sm">
          {formatCurrencyEstimate(parseFloat(String(editValues.quantity)) * parseFloat(String(editValues.unitCost)) || 0)}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "grid grid-cols-[auto_auto_1fr_80px_60px_80px_60px_80px_80px_auto] gap-2 items-center p-2 hover:bg-muted/50 rounded-md group",
        isSelected && "bg-primary/5",
        isDragging && "opacity-50 bg-muted"
      )}
      onDoubleClick={handleDoubleClick}
    >
      <div 
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      <div className="flex items-center gap-2 min-w-0">
        <Badge 
          variant="outline" 
          className="text-xs flex-shrink-0"
          style={{ borderColor: `var(--${typeConfig?.color || 'gray'}-200)` }}
        >
          {typeConfig?.label.slice(0, 3) || 'OTH'}
        </Badge>
        <span className="truncate text-sm">{item.description}</span>
      </div>
      <div className="text-right text-sm text-muted-foreground">
        {item.quantity.toLocaleString()}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {item.unit}
      </div>
      <div className="text-right text-sm">
        {formatCurrencyEstimate(item.unitCost)}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {item.markup}%
      </div>
      <div className="text-right text-sm font-medium">
        {formatCurrencyEstimate(item.totalCost)}
      </div>
      <div className="text-right text-sm font-medium text-primary">
        {formatCurrencyEstimate(item.totalWithMarkup)}
      </div>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
