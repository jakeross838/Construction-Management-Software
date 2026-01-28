import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Percent, ArrowRight, X } from 'lucide-react';
import { LineItemType, lineItemTypes } from '@/types/estimate';
import { useState } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onApplyMarkup: (markup: number) => void;
  onChangeType: (type: LineItemType) => void;
  onMoveToSection: (sectionId: string) => void;
  sections: { id: string; name: string }[];
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onDelete,
  onApplyMarkup,
  onChangeType,
  onMoveToSection,
  sections,
}: BulkActionsBarProps) {
  const [markupValue, setMarkupValue] = useState('');
  const [showMarkupInput, setShowMarkupInput] = useState(false);

  if (selectedCount === 0) return null;

  const handleApplyMarkup = () => {
    const markup = parseFloat(markupValue);
    if (!isNaN(markup)) {
      onApplyMarkup(markup);
      setMarkupValue('');
      setShowMarkupInput(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
      <div className="flex items-center gap-2 pr-3 border-r">
        <span className="text-sm font-medium">{selectedCount} selected</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Markup */}
      {showMarkupInput ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Markup %"
            value={markupValue}
            onChange={(e) => setMarkupValue(e.target.value)}
            className="w-24 h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyMarkup();
              if (e.key === 'Escape') setShowMarkupInput(false);
            }}
          />
          <Button size="sm" onClick={handleApplyMarkup}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowMarkupInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowMarkupInput(true)}>
          <Percent className="mr-2 h-4 w-4" />
          Set Markup
        </Button>
      )}

      {/* Change Type */}
      <Select onValueChange={(v) => onChangeType(v as LineItemType)}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Change Type" />
        </SelectTrigger>
        <SelectContent>
          {lineItemTypes.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Move to Section */}
      {sections.length > 1 && (
        <Select onValueChange={onMoveToSection}>
          <SelectTrigger className="h-8 w-40">
            <ArrowRight className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Move to..." />
          </SelectTrigger>
          <SelectContent>
            {sections.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Delete */}
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}
