import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Search, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Copy,
  FileText,
  Layers,
  Star,
} from 'lucide-react';
import { 
  useEstimateTemplates, 
  useDeleteTemplate, 
  useUpdateTemplate,
  EstimateTemplate,
  templateToEstimate,
} from '@/hooks/useEstimateTemplates';
import { Estimate, formatCurrencyCompact } from '@/types/estimate';
import { Skeleton } from '@/components/ui/skeleton';

interface TemplatesTabProps {
  onCreateFromTemplate: (templateData: Partial<Estimate>) => void;
  onEditTemplate: (template: EstimateTemplate) => void;
}

export function TemplatesTab({ onCreateFromTemplate, onEditTemplate }: TemplatesTabProps) {
  const { data: templates, isLoading } = useEstimateTemplates();
  const deleteTemplate = useDeleteTemplate();
  const updateTemplate = useUpdateTemplate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<EstimateTemplate | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    templates?.forEach(t => cats.add(t.category));
    return ['all', ...Array.from(cats).sort()];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    
    return templates.filter(template => {
      if (categoryFilter !== 'all' && template.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          (template.description?.toLowerCase().includes(query) ?? false) ||
          template.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [templates, searchQuery, categoryFilter]);

  const handleUseTemplate = (template: EstimateTemplate) => {
    const estimateData = templateToEstimate(template);
    onCreateFromTemplate(estimateData);
  };

  const handleToggleDefault = (template: EstimateTemplate) => {
    updateTemplate.mutate({
      id: template.id,
      is_default: !template.is_default,
    });
  };

  const handleDeleteTemplate = () => {
    if (deleteConfirm) {
      deleteTemplate.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const countLineItems = (template: EstimateTemplate): number => {
    return template.sections.reduce((sum, section) => 
      sum + section.groups.reduce((gSum, group) => 
        gSum + group.subgroups.reduce((sgSum, subgroup) => 
          sgSum + subgroup.lineItems.length, 0
        ), 0
      ), 0
    );
  };

  const calculateTemplateTotal = (template: EstimateTemplate): number => {
    return template.sections.reduce((sum, section) => sum + (section.subtotalWithMarkup || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No templates yet</p>
            <p className="text-sm mb-4">
              Create a template by saving an existing estimate, or build one from scratch.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card 
              key={template.id} 
              className="hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleUseTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      {template.is_default && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditTemplate(template); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleDefault(template); }}>
                        <Star className="mr-2 h-4 w-4" />
                        {template.is_default ? 'Remove Default' : 'Set as Default'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(template); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {template.sections.length} sections
                    </span>
                    <span>{countLineItems(template)} items</span>
                  </div>
                  <span className="font-semibold text-primary">
                    {formatCurrencyCompact(calculateTemplateTotal(template))}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={(e) => { e.stopPropagation(); handleUseTemplate(template); }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Use This Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
