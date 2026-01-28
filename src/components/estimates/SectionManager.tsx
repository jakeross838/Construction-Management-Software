import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Copy,
} from 'lucide-react';
import { 
  EstimateSection, 
  EstimateLineItem, 
  formatCurrencyEstimate,
  lineItemTypes,
} from '@/types/estimate';
import { LineItemForm } from './LineItemForm';

interface SectionManagerProps {
  sections: EstimateSection[];
  onAddSection: () => void;
  onUpdateSection: (sectionId: string, data: Partial<EstimateSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddLineItem: (sectionId: string, data: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>) => void;
  onUpdateLineItem: (sectionId: string, lineItemId: string, data: Partial<EstimateLineItem>) => void;
  onDeleteLineItem: (sectionId: string, lineItemId: string) => void;
}

const typeIcons = {
  material: Package,
  labor: Wrench,
  subcontractor: Users,
  equipment: Truck,
  other: Layers,
};

const typeColors = {
  material: 'text-blue-500',
  labor: 'text-green-500',
  subcontractor: 'text-purple-500',
  equipment: 'text-amber-500',
  other: 'text-gray-500',
};

export function SectionManager({
  sections,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
}: SectionManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'section' | 'lineItem'; sectionId: string; lineItemId?: string } | null>(null);
  const [lineItemDialog, setLineItemDialog] = useState<{ sectionId: string; lineItem?: EstimateLineItem } | null>(null);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const startEditingSection = (section: EstimateSection) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const saveSection = (sectionId: string) => {
    if (editingSectionName.trim()) {
      onUpdateSection(sectionId, { name: editingSectionName.trim() });
    }
    setEditingSectionId(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    
    if (deleteConfirm.type === 'section') {
      onDeleteSection(deleteConfirm.sectionId);
    } else if (deleteConfirm.lineItemId) {
      onDeleteLineItem(deleteConfirm.sectionId, deleteConfirm.lineItemId);
    }
    setDeleteConfirm(null);
  };

  const handleSaveLineItem = (data: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>) => {
    if (!lineItemDialog) return;
    
    if (lineItemDialog.lineItem) {
      onUpdateLineItem(lineItemDialog.sectionId, lineItemDialog.lineItem.id, data);
    } else {
      onAddLineItem(lineItemDialog.sectionId, data);
    }
  };

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const Icon = expandedSections.has(section.id) ? ChevronDown : ChevronRight;
        
        return (
          <Card key={section.id} className="overflow-hidden">
            <Collapsible open={expandedSections.has(section.id)} onOpenChange={() => toggleSection(section.id)}>
              <CardHeader className="py-3 px-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Icon className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    {editingSectionId === section.id ? (
                      <Input
                        value={editingSectionName}
                        onChange={(e) => setEditingSectionName(e.target.value)}
                        onBlur={() => saveSection(section.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveSection(section.id)}
                        className="h-7 w-48"
                        autoFocus
                      />
                    ) : (
                      <CardTitle className="text-base font-medium">{section.name}</CardTitle>
                    )}
                    <Badge variant="outline" className="ml-2">
                      {section.lineItems.length} items
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
                        <DropdownMenuItem onClick={() => startEditingSection(section)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename Section
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLineItemDialog({ sectionId: section.id })}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Line Item
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteConfirm({ type: 'section', sectionId: section.id })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Section
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="p-0">
                  {section.lineItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-24">Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right w-20">Qty</TableHead>
                          <TableHead className="w-16">Unit</TableHead>
                          <TableHead className="text-right w-24">Unit Cost</TableHead>
                          <TableHead className="text-right w-20">Markup</TableHead>
                          <TableHead className="text-right w-28">Total</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {section.lineItems.map((item) => {
                          const TypeIcon = typeIcons[item.type];
                          return (
                            <TableRow key={item.id} className="group">
                              <TableCell>
                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TypeIcon className={`h-4 w-4 ${typeColors[item.type]}`} />
                                  <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <p className="font-medium truncate">{item.description}</p>
                                  {item.category && (
                                    <p className="text-xs text-muted-foreground">{item.category}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrencyEstimate(item.unitCost)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.markupType === 'percentage' ? `${item.markup}%` : formatCurrencyEstimate(item.markup)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrencyEstimate(item.totalWithMarkup)}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setLineItemDialog({ sectionId: section.id, lineItem: item })}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Copy className="mr-2 h-4 w-4" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => setDeleteConfirm({ type: 'lineItem', sectionId: section.id, lineItemId: item.id })}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No line items yet</p>
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => setLineItemDialog({ sectionId: section.id })}
                      >
                        Add the first item
                      </Button>
                    </div>
                  )}
                  
                  {section.lineItems.length > 0 && (
                    <div className="px-4 py-3 border-t bg-muted/20 flex justify-between items-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setLineItemDialog({ sectionId: section.id })}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item
                      </Button>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Section Total: </span>
                        <span className="font-semibold">{formatCurrencyEstimate(section.subtotalWithMarkup)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      <Button variant="outline" className="w-full" onClick={onAddSection}>
        <Plus className="mr-2 h-4 w-4" />
        Add Section
      </Button>

      {/* Line Item Form Dialog */}
      <LineItemForm
        open={!!lineItemDialog}
        onOpenChange={(open) => !open && setLineItemDialog(null)}
        lineItem={lineItemDialog?.lineItem}
        onSave={handleSaveLineItem}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteConfirm?.type === 'section' ? 'Section' : 'Line Item'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'section' 
                ? 'This will permanently delete this section and all its line items.'
                : 'This will permanently delete this line item.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
