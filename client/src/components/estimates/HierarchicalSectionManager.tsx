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
  FolderOpen,
  Folder,
  FileText,
} from 'lucide-react';
import { 
  EstimateSection, 
  EstimateGroup,
  EstimateSubgroup,
  EstimateLineItem, 
  formatCurrencyEstimate,
  generateId,
} from '@/types/estimate';
import { LineItemForm } from './LineItemForm';

interface HierarchicalSectionManagerProps {
  sections: EstimateSection[];
  onUpdateSections: (sections: EstimateSection[]) => void;
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

type DeleteTarget = {
  type: 'section' | 'group' | 'subgroup' | 'lineItem';
  sectionId: string;
  groupId?: string;
  subgroupId?: string;
  lineItemId?: string;
};

type LineItemDialogState = {
  sectionId: string;
  groupId: string;
  subgroupId: string;
  lineItem?: EstimateLineItem;
} | null;

export function HierarchicalSectionManager({
  sections,
  onUpdateSections,
}: HierarchicalSectionManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);
  const [lineItemDialog, setLineItemDialog] = useState<LineItemDialogState>(null);

  // Toggle helpers
  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const newSet = new Set(set);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    return newSet;
  };

  // Add handlers
  const handleAddSection = () => {
    const newSection: EstimateSection = {
      id: generateId('sec'),
      name: `Section ${sections.length + 1}`,
      groups: [],
      subtotal: 0,
      subtotalWithMarkup: 0,
      sortOrder: sections.length + 1,
    };
    onUpdateSections([...sections, newSection]);
    setExpandedSections(prev => new Set([...prev, newSection.id]));
  };

  const handleAddGroup = (sectionId: string) => {
    const newSections = sections.map(section => {
      if (section.id !== sectionId) return section;
      const newGroup: EstimateGroup = {
        id: generateId('grp'),
        name: `Group ${section.groups.length + 1}`,
        subgroups: [],
        subtotal: 0,
        subtotalWithMarkup: 0,
        sortOrder: section.groups.length + 1,
      };
      setExpandedGroups(prev => new Set([...prev, newGroup.id]));
      return { ...section, groups: [...section.groups, newGroup] };
    });
    onUpdateSections(newSections);
  };

  const handleAddSubgroup = (sectionId: string, groupId: string) => {
    const newSections = sections.map(section => {
      if (section.id !== sectionId) return section;
      const groups = section.groups.map(group => {
        if (group.id !== groupId) return group;
        const newSubgroup: EstimateSubgroup = {
          id: generateId('sub'),
          name: `Subgroup ${group.subgroups.length + 1}`,
          lineItems: [],
          subtotal: 0,
          subtotalWithMarkup: 0,
          sortOrder: group.subgroups.length + 1,
        };
        setExpandedSubgroups(prev => new Set([...prev, newSubgroup.id]));
        return { ...group, subgroups: [...group.subgroups, newSubgroup] };
      });
      return { ...section, groups };
    });
    onUpdateSections(newSections);
  };

  // Edit name handlers
  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const saveEditing = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    const newSections = sections.map(section => {
      if (section.id === editingId) {
        return { ...section, name: editingName.trim() };
      }
      const groups = section.groups.map(group => {
        if (group.id === editingId) {
          return { ...group, name: editingName.trim() };
        }
        const subgroups = group.subgroups.map(subgroup => {
          if (subgroup.id === editingId) {
            return { ...subgroup, name: editingName.trim() };
          }
          return subgroup;
        });
        return { ...group, subgroups };
      });
      return { ...section, groups };
    });

    onUpdateSections(newSections);
    setEditingId(null);
  };

  // Delete handlers
  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;

    let newSections = [...sections];

    if (deleteConfirm.type === 'section') {
      newSections = sections.filter(s => s.id !== deleteConfirm.sectionId);
    } else if (deleteConfirm.type === 'group') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        return { ...section, groups: section.groups.filter(g => g.id !== deleteConfirm.groupId) };
      });
    } else if (deleteConfirm.type === 'subgroup') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        const groups = section.groups.map(group => {
          if (group.id !== deleteConfirm.groupId) return group;
          return { ...group, subgroups: group.subgroups.filter(sg => sg.id !== deleteConfirm.subgroupId) };
        });
        return { ...section, groups };
      });
    } else if (deleteConfirm.type === 'lineItem') {
      newSections = sections.map(section => {
        if (section.id !== deleteConfirm.sectionId) return section;
        const groups = section.groups.map(group => {
          if (group.id !== deleteConfirm.groupId) return group;
          const subgroups = group.subgroups.map(subgroup => {
            if (subgroup.id !== deleteConfirm.subgroupId) return subgroup;
            return { ...subgroup, lineItems: subgroup.lineItems.filter(li => li.id !== deleteConfirm.lineItemId) };
          });
          return { ...group, subgroups };
        });
        return { ...section, groups };
      });
    }

    onUpdateSections(newSections);
    setDeleteConfirm(null);
  };

  // Line item handlers
  const handleSaveLineItem = (data: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>) => {
    if (!lineItemDialog) return;

    const newSections = sections.map(section => {
      if (section.id !== lineItemDialog.sectionId) return section;
      const groups = section.groups.map(group => {
        if (group.id !== lineItemDialog.groupId) return group;
        const subgroups = group.subgroups.map(subgroup => {
          if (subgroup.id !== lineItemDialog.subgroupId) return subgroup;
          
          if (lineItemDialog.lineItem) {
            // Update existing
            const lineItems = subgroup.lineItems.map(li => 
              li.id === lineItemDialog.lineItem!.id ? { ...li, ...data } : li
            );
            return { ...subgroup, lineItems };
          } else {
            // Add new
            const newItem: EstimateLineItem = {
              ...data,
              id: generateId('li'),
              sortOrder: subgroup.lineItems.length + 1,
              totalCost: data.quantity * data.unitCost,
              totalWithMarkup: 0,
            };
            return { ...subgroup, lineItems: [...subgroup.lineItems, newItem] };
          }
        });
        return { ...group, subgroups };
      });
      return { ...section, groups };
    });

    onUpdateSections(newSections);
  };

  const getItemCount = (section: EstimateSection): number => {
    return section.groups.reduce((sum, g) => 
      sum + g.subgroups.reduce((sum2, sg) => sum2 + sg.lineItems.length, 0), 0
    );
  };

  const renderEditableTitle = (id: string, name: string, className: string = '') => {
    if (editingId === id) {
      return (
        <Input
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={saveEditing}
          onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
          className={`h-7 w-48 ${className}`}
          autoFocus
        />
      );
    }
    return <span className={className}>{name}</span>;
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <Collapsible 
            open={expandedSections.has(section.id)} 
            onOpenChange={() => setExpandedSections(prev => toggleSet(prev, section.id))}
          >
            {/* Section Header */}
            <CardHeader className="py-3 px-4 bg-primary/5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {expandedSections.has(section.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {renderEditableTitle(section.id, section.name, 'font-semibold')}
                  <Badge variant="outline" className="ml-2">
                    {section.groups.length} groups • {getItemCount(section)} items
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
                      <DropdownMenuItem onClick={() => startEditing(section.id, section.name)}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddGroup(section.id)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Group
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteConfirm({ type: 'section', sectionId: section.id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Section
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="p-2 space-y-2">
                {section.groups.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No groups yet</p>
                    <Button variant="link" size="sm" onClick={() => handleAddGroup(section.id)}>
                      Add the first group
                    </Button>
                  </div>
                ) : (
                  section.groups.map((group) => (
                    <Collapsible
                      key={group.id}
                      open={expandedGroups.has(group.id)}
                      onOpenChange={() => setExpandedGroups(prev => toggleSet(prev, group.id))}
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5">
                              {expandedGroups.has(group.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                          </CollapsibleTrigger>
                          <Folder className="h-4 w-4 text-amber-500" />
                          {renderEditableTitle(group.id, group.name, 'font-medium text-sm')}
                          <Badge variant="secondary" className="text-xs">
                            {group.subgroups.length} subgroups
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatCurrencyEstimate(group.subtotalWithMarkup)}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startEditing(group.id, group.name)}>
                                <Pencil className="mr-2 h-4 w-4" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddSubgroup(section.id, group.id)}>
                                <Plus className="mr-2 h-4 w-4" /> Add Subgroup
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteConfirm({ type: 'group', sectionId: section.id, groupId: group.id })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="ml-6 mt-2 space-y-2">
                          {group.subgroups.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              <p>No subgroups yet</p>
                              <Button variant="link" size="sm" onClick={() => handleAddSubgroup(section.id, group.id)}>
                                Add the first subgroup
                              </Button>
                            </div>
                          ) : (
                            group.subgroups.map((subgroup) => (
                              <Collapsible
                                key={subgroup.id}
                                open={expandedSubgroups.has(subgroup.id)}
                                onOpenChange={() => setExpandedSubgroups(prev => toggleSet(prev, subgroup.id))}
                              >
                                {/* Subgroup Header */}
                                <div className="flex items-center justify-between py-2 px-3 bg-background border rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-5 w-5">
                                        {expandedSubgroups.has(subgroup.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      </Button>
                                    </CollapsibleTrigger>
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    {renderEditableTitle(subgroup.id, subgroup.name, 'text-sm')}
                                    <Badge variant="outline" className="text-xs">
                                      {subgroup.lineItems.length} items
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{formatCurrencyEstimate(subgroup.subtotalWithMarkup)}</span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => startEditing(subgroup.id, subgroup.name)}>
                                          <Pencil className="mr-2 h-4 w-4" /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setLineItemDialog({ 
                                          sectionId: section.id, 
                                          groupId: group.id, 
                                          subgroupId: subgroup.id 
                                        })}>
                                          <Plus className="mr-2 h-4 w-4" /> Add Item
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          className="text-destructive"
                                          onClick={() => setDeleteConfirm({ 
                                            type: 'subgroup', 
                                            sectionId: section.id, 
                                            groupId: group.id, 
                                            subgroupId: subgroup.id 
                                          })}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" /> Delete Subgroup
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                <CollapsibleContent>
                                  <div className="ml-4 mt-1">
                                    {subgroup.lineItems.length === 0 ? (
                                      <div className="text-center py-3 text-muted-foreground text-xs">
                                        <p>No items yet</p>
                                        <Button 
                                          variant="link" 
                                          size="sm" 
                                          className="text-xs"
                                          onClick={() => setLineItemDialog({ 
                                            sectionId: section.id, 
                                            groupId: group.id, 
                                            subgroupId: subgroup.id 
                                          })}
                                        >
                                          Add the first item
                                        </Button>
                                      </div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="hover:bg-transparent text-xs">
                                            <TableHead className="w-20 py-1">Type</TableHead>
                                            <TableHead className="py-1">Description</TableHead>
                                            <TableHead className="text-right py-1 w-16">Qty</TableHead>
                                            <TableHead className="py-1 w-12">Unit</TableHead>
                                            <TableHead className="text-right py-1 w-20">Cost</TableHead>
                                            <TableHead className="text-right py-1 w-24">Total</TableHead>
                                            <TableHead className="w-8 py-1"></TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {subgroup.lineItems.map((item) => {
                                            const TypeIcon = typeIcons[item.type];
                                            return (
                                              <TableRow key={item.id} className="group text-xs">
                                                <TableCell className="py-1">
                                                  <div className="flex items-center gap-1">
                                                    <TypeIcon className={`h-3 w-3 ${typeColors[item.type]}`} />
                                                    <span className="text-muted-foreground capitalize">{item.type}</span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="py-1 font-medium">{item.description}</TableCell>
                                                <TableCell className="text-right py-1 font-mono">{item.quantity}</TableCell>
                                                <TableCell className="py-1 text-muted-foreground">{item.unit}</TableCell>
                                                <TableCell className="text-right py-1 font-mono">{formatCurrencyEstimate(item.unitCost)}</TableCell>
                                                <TableCell className="text-right py-1 font-semibold">{formatCurrencyEstimate(item.totalWithMarkup)}</TableCell>
                                                <TableCell className="py-1">
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                                        <MoreHorizontal className="h-3 w-3" />
                                                      </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                      <DropdownMenuItem onClick={() => setLineItemDialog({ 
                                                        sectionId: section.id, 
                                                        groupId: group.id, 
                                                        subgroupId: subgroup.id,
                                                        lineItem: item
                                                      })}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem>
                                                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                                                      </DropdownMenuItem>
                                                      <DropdownMenuSeparator />
                                                      <DropdownMenuItem 
                                                        className="text-destructive"
                                                        onClick={() => setDeleteConfirm({ 
                                                          type: 'lineItem', 
                                                          sectionId: section.id, 
                                                          groupId: group.id, 
                                                          subgroupId: subgroup.id,
                                                          lineItemId: item.id
                                                        })}
                                                      >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                      </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    )}
                                    {subgroup.lineItems.length > 0 && (
                                      <div className="flex justify-end py-1 px-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="text-xs h-6"
                                          onClick={() => setLineItemDialog({ 
                                            sectionId: section.id, 
                                            groupId: group.id, 
                                            subgroupId: subgroup.id 
                                          })}
                                        >
                                          <Plus className="mr-1 h-3 w-3" /> Add Item
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ))
                          )}
                          {group.subgroups.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-xs"
                              onClick={() => handleAddSubgroup(section.id, group.id)}
                            >
                              <Plus className="mr-1 h-3 w-3" /> Add Subgroup
                            </Button>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
                {section.groups.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleAddGroup(section.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Group
                  </Button>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={handleAddSection}>
        <Plus className="mr-2 h-4 w-4" /> Add Section
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
              Delete {deleteConfirm?.type === 'section' ? 'Section' : 
                      deleteConfirm?.type === 'group' ? 'Group' :
                      deleteConfirm?.type === 'subgroup' ? 'Subgroup' : 'Item'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. 
              {deleteConfirm?.type === 'section' && ' All groups, subgroups, and items will be deleted.'}
              {deleteConfirm?.type === 'group' && ' All subgroups and items will be deleted.'}
              {deleteConfirm?.type === 'subgroup' && ' All items will be deleted.'}
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
