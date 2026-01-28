import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POEditableFieldProps {
  value: string | number | null;
  onSave: (value: string | number) => void;
  type?: 'text' | 'textarea' | 'number' | 'currency';
  className?: string;
  displayClassName?: string;
  placeholder?: string;
  formatDisplay?: (value: string | number | null) => string;
  disabled?: boolean;
}

export function POEditableField({
  value,
  onSave,
  type = 'text',
  className,
  displayClassName,
  placeholder = '—',
  formatDisplay,
  disabled = false,
}: POEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    let finalValue: string | number = editValue;
    if (type === 'number' || type === 'currency') {
      finalValue = parseFloat(editValue) || 0;
    }
    onSave(finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ''));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatDisplay 
    ? formatDisplay(value) 
    : (value ?? placeholder);

  if (disabled) {
    return <span className={displayClassName}>{displayValue}</span>;
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {type === 'textarea' ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] text-sm"
            placeholder={placeholder}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === 'currency' || type === 'number' ? 'number' : 'text'}
            step={type === 'currency' ? '0.01' : undefined}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm"
            placeholder={placeholder}
          />
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel}>
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <span 
      className={cn(
        "group cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 inline-flex items-center gap-1",
        displayClassName
      )}
      onClick={() => {
        setEditValue(String(value ?? ''));
        setIsEditing(true);
      }}
    >
      {displayValue}
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}
