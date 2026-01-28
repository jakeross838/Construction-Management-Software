import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Briefcase, FileText, Check, X, Edit2, Sparkles } from 'lucide-react';
import { AIConfidenceBadge, getConfidenceLevel } from './AIConfidenceBadge';
import { cn } from '@/lib/utils';

interface MatchedEntity {
  id: string;
  name: string;
  confidence: number;
  matchType?: string;
  subtitle?: string;
}

interface AIMatchedEntityCardProps {
  type: 'vendor' | 'job' | 'po';
  matched: MatchedEntity | null;
  extracted?: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  isEditing?: boolean;
  className?: string;
}

const typeConfig = {
  vendor: {
    icon: Building2,
    label: 'Vendor',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  job: {
    icon: Briefcase,
    label: 'Job',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  po: {
    icon: FileText,
    label: 'Purchase Order',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
};

export function AIMatchedEntityCard({
  type,
  matched,
  extracted,
  onAccept,
  onReject,
  onEdit,
  isEditing = false,
  className,
}: AIMatchedEntityCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const confidenceLevel = matched ? getConfidenceLevel(matched.confidence) : null;
  
  const isHighConfidence = confidenceLevel === 'high';
  const needsVerification = confidenceLevel === 'medium' || confidenceLevel === 'low';

  return (
    <Card className={cn(
      'transition-all',
      isEditing && 'ring-2 ring-primary',
      !matched && 'border-dashed',
      className
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'p-2 rounded-lg shrink-0',
            matched ? config.bgColor : 'bg-muted'
          )}>
            <Icon className={cn('h-4 w-4', matched ? config.color : 'text-muted-foreground')} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {config.label}
              </span>
              {matched && (
                <AIConfidenceBadge confidence={matched.confidence} size="sm" />
              )}
              {matched?.matchType && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {matched.matchType}
                </Badge>
              )}
            </div>

            {matched ? (
              <div>
                <p className="font-medium truncate">{matched.name}</p>
                {matched.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{matched.subtitle}</p>
                )}
                {extracted && extracted !== matched.name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Extracted: "{extracted}"
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground italic">No match found</p>
                {extracted && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Extracted: "{extracted}"
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {matched && needsVerification && onAccept && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={onAccept}
                title="Accept match"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 w-7 p-0',
                  isEditing ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={onEdit}
                title="Change selection"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SuggestionOption {
  id: string;
  name: string;
  score: number;
  subtitle?: string;
}

interface AIEntitySuggestionsProps {
  type: 'vendor' | 'job' | 'po';
  suggestions: SuggestionOption[];
  onSelect: (id: string) => void;
  maxShow?: number;
}

export function AIEntitySuggestions({ 
  type, 
  suggestions, 
  onSelect,
  maxShow = 3
}: AIEntitySuggestionsProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  
  if (!suggestions.length) return null;

  const displaySuggestions = suggestions.slice(0, maxShow);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Other possible {config.label.toLowerCase()}s:
      </p>
      <div className="space-y-1">
        {displaySuggestions.map(suggestion => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.id)}
            className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-primary/20 hover:bg-muted/50 transition-colors text-left"
          >
            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate text-sm">{suggestion.name}</span>
            {suggestion.subtitle && (
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {suggestion.subtitle}
              </span>
            )}
            <AIConfidenceBadge confidence={suggestion.score} size="sm" showPercent />
          </button>
        ))}
      </div>
      {suggestions.length > maxShow && (
        <p className="text-xs text-muted-foreground text-center">
          +{suggestions.length - maxShow} more
        </p>
      )}
    </div>
  );
}
