import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Plus, 
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Download,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import {
  useSelections,
  useSelectionStats,
  useUpdateSelection,
  useDeleteSelection,
  Selection,
  CATEGORY_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ROOM_AREA_OPTIONS,
} from '@/hooks/useSelections';
import { SelectionStats } from '@/components/selections/SelectionStats';
import { SelectionFormDialog } from '@/components/selections/SelectionFormDialog';
import { SelectionDetailPanel } from '@/components/selections/SelectionDetailPanel';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Selections = () => {
  const { selectedJobId, selectedJobName } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingSelection, setEditingSelection] = useState<Selection | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const { data: selections = [], isLoading } = useSelections();
  const { data: stats, isLoading: statsLoading } = useSelectionStats(selectedJobId);
  const updateMutation = useUpdateSelection();
  const deleteMutation = useDeleteSelection();

  const filteredSelections = useMemo(() => {
    let filtered = selections;

    if (selectedJobId) {
      const contextJobId = String(selectedJobId);
      const contextJobName = selectedJobName?.trim().toLowerCase() || '';
      filtered = filtered.filter(s => {
        const selJobId = s.job_id ? String(s.job_id) : '';
        if (selJobId && selJobId === contextJobId) return true;
        if (contextJobName && s.job_name?.trim().toLowerCase() === contextJobName) return true;
        return false;
      });
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(s => s.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.approval_status === statusFilter);
    }

    if (roomFilter !== 'all') {
      filtered = filtered.filter(s => s.room_area === roomFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.vendor_name?.toLowerCase().includes(query) ||
        s.room_area?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selections, searchQuery, categoryFilter, statusFilter, roomFilter, selectedJobId, selectedJobName]);

  // Get unique rooms from data
  const availableRooms = useMemo(() => {
    const rooms = new Set(selections.map(s => s.room_area).filter(Boolean));
    return Array.from(rooms) as string[];
  }, [selections]);

  const handleEdit = (selection: Selection) => {
    setEditingSelection(selection);
    setShowFormDialog(true);
  };

  const handleFormClose = (open: boolean) => {
    setShowFormDialog(open);
    if (!open) setEditingSelection(null);
  };

  const handleApprove = (selection: Selection) => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'Current User',
    });
  };

  const handleReject = (selection: Selection) => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'rejected',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this selection?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredSelections.map(s => s.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedRows);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedRows(newSet);
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORY_OPTIONS.find(c => c.value === category) || { icon: '📦', label: category };
  };

  const getApprovalStatusInfo = (status: string) => {
    return APPROVAL_STATUS_OPTIONS.find(s => s.value === status) || APPROVAL_STATUS_OPTIONS[0];
  };

  const getOrderStatusInfo = (status: string) => {
    return ORDER_STATUS_OPTIONS.find(s => s.value === status) || ORDER_STATUS_OPTIONS[0];
  };

  const allSelected = filteredSelections.length > 0 && selectedRows.size === filteredSelections.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < filteredSelections.length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <SelectionStats stats={stats} isLoading={statsLoading} />

        {/* Main Table Card */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 p-4 border-b sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search selections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-muted/50 border-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {APPROVAL_STATUS_OPTIONS.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-muted/50 border-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORY_OPTIONS.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={roomFilter} onValueChange={setRoomFilter}>
                  <SelectTrigger className="w-[140px] bg-muted/50 border-0">
                    <SelectValue placeholder="Room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {availableRooms.map(room => (
                      <SelectItem key={room} value={room}>
                        {room}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {selectedRows.size > 0 && (
                  <span className="text-sm text-muted-foreground mr-2">
                    {selectedRows.size} selected
                  </span>
                )}
                <Button onClick={() => setShowFormDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Selection
                </Button>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSelections.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Filter className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No selections found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first selection'}
                </p>
                <Button onClick={() => setShowFormDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Selection
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                          className={someSelected ? 'data-[state=checked]:bg-primary' : ''}
                        />
                      </TableHead>
                      <TableHead className="min-w-[280px]">SELECTION</TableHead>
                      <TableHead>CATEGORY</TableHead>
                      <TableHead>ROOM</TableHead>
                      <TableHead className="text-right">ALLOWANCE</TableHead>
                      <TableHead className="text-right">ACTUAL</TableHead>
                      <TableHead className="text-right">VARIANCE</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSelections.map((selection) => {
                      const categoryInfo = getCategoryInfo(selection.category);
                      const approvalStatusInfo = getApprovalStatusInfo(selection.approval_status);
                      const orderStatusInfo = getOrderStatusInfo(selection.order_status);
                      const variance = selection.allowance_amount - selection.actual_cost;
                      const isSelected = selectedRows.has(selection.id);

                      return (
                        <TableRow 
                          key={selection.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected && "bg-primary/5"
                          )}
                          onClick={() => setSelectedSelection(selection)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRow(selection.id, !!checked)}
                              aria-label={`Select ${selection.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 rounded-lg">
                                {selection.image_url ? (
                                  <AvatarImage src={selection.image_url} alt={selection.name} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg">
                                  {categoryInfo.icon}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{selection.name}</p>
                                  {selection.reference_url && (
                                    <a
                                      href={selection.reference_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-muted-foreground hover:text-primary flex-shrink-0"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                                {selection.description && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[240px]">
                                    {selection.description}
                                  </p>
                                )}
                                {selection.vendor_name && (
                                  <p className="text-xs text-muted-foreground">
                                    {selection.vendor_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm whitespace-nowrap">
                              {categoryInfo.icon} {categoryInfo.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {selection.room_area || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(selection.allowance_amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(selection.actual_cost)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-sm font-medium",
                            variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : ""
                          )}>
                            {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs w-fit px-2 py-0.5",
                                  approvalStatusInfo.value === 'approved' && "bg-green-100 text-green-700 hover:bg-green-100",
                                  approvalStatusInfo.value === 'pending' && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                                  approvalStatusInfo.value === 'rejected' && "bg-red-100 text-red-700 hover:bg-red-100"
                                )}
                              >
                                {approvalStatusInfo.label}
                              </Badge>
                              {selection.order_status !== 'not_ordered' && (
                                <Badge variant="outline" className={cn("text-xs w-fit", orderStatusInfo.color)}>
                                  {orderStatusInfo.label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setSelectedSelection(selection)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(selection)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {selection.reference_url && (
                                  <DropdownMenuItem asChild>
                                    <a
                                      href={selection.reference_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      View Product
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {selection.approval_status === 'pending' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleApprove(selection)} className="text-green-600">
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReject(selection)} className="text-red-600">
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(selection.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
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
              </div>
            )}

            {/* Footer */}
            {filteredSelections.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>
                  Showing {filteredSelections.length} of {selections.length} selections
                </span>
                <div className="flex items-center gap-2">
                  <span>Rows per page: 10</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SelectionFormDialog
        open={showFormDialog}
        onOpenChange={handleFormClose}
        selection={editingSelection}
        defaultJobId={selectedJobId}
      />

      <SelectionDetailPanel
        selection={selectedSelection}
        open={!!selectedSelection}
        onOpenChange={(open) => !open && setSelectedSelection(null)}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
};

export default Selections;
