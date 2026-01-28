import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Package, Pencil, ChevronRight, TrendingDown } from 'lucide-react';
import {
  useMasterItems,
  useCreateMasterItem,
  useUpdateMasterItem,
  useCurrentPrices,
  MasterItem,
  MATERIAL_CATEGORIES,
} from '@/hooks/usePricing';
import { cn } from '@/lib/utils';
import { MaterialDetailPanel } from './MaterialDetailPanel';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function MaterialsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MasterItem | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const { data: items = [], isLoading } = useMasterItems();
  const { data: currentPrices = [] } = useCurrentPrices();
  const createMutation = useCreateMasterItem();
  const updateMutation = useUpdateMasterItem();

  // Build a map of master_item_id -> best price info
  const priceMap = currentPrices.reduce((acc, price) => {
    const existing = acc[price.master_item_id];
    if (!existing || price.latest_price < existing.lowestPrice) {
      acc[price.master_item_id] = {
        lowestPrice: price.latest_price,
        lowestVendor: price.vendor_name,
        unit: price.unit,
        priceCount: (existing?.priceCount || 0) + price.price_count,
        vendorCount: (existing?.vendorCount || 0) + 1,
      };
    } else {
      acc[price.master_item_id].priceCount += price.price_count;
      acc[price.master_item_id].vendorCount += 1;
    }
    return acc;
  }, {} as Record<string, { lowestPrice: number; lowestVendor?: string; unit: string; priceCount: number; vendorCount: number }>);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'lumber',
    default_unit: 'each',
    waste_factor_percent: 5,
  });

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenDialog = (item?: MasterItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        category: item.category,
        default_unit: item.default_unit,
        waste_factor_percent: item.waste_factor_percent,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        category: 'lumber',
        default_unit: 'each',
        waste_factor_percent: 5,
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
    setShowDialog(false);
  };

  const categoryGroups = MATERIAL_CATEGORIES.reduce((acc, cat) => {
    if (!cat) return acc; // Skip empty categories
    const count = items.filter((i) => i.category === cat).length;
    if (count > 0) acc[cat] = count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-semibold">{items.length}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-semibold">{Object.keys(categoryGroups).length}</p>
              </div>
              <div className="flex flex-wrap gap-1 max-w-[100px]">
                {Object.keys(categoryGroups).slice(0, 3).map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {MATERIAL_CATEGORIES.filter((cat) => cat).map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No materials found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Best Price</TableHead>
                  <TableHead className="text-right">Data Points</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const priceInfo = priceMap[item.id];
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetailPanel(true);
                      }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {priceInfo ? (
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-green-500" />
                            <div>
                              <p className="font-mono font-medium text-green-600">
                                {formatCurrency(priceInfo.lowestPrice)}/{priceInfo.unit}
                              </p>
                              {priceInfo.lowestVendor && (
                                <p className="text-xs text-muted-foreground">
                                  {priceInfo.lowestVendor}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No data</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {priceInfo ? (
                          <div className="text-sm">
                            <span className="font-medium">{priceInfo.priceCount}</span>
                            <span className="text-muted-foreground"> from </span>
                            <span className="font-medium">{priceInfo.vendorCount}</span>
                            <span className="text-muted-foreground"> vendor{priceInfo.vendorCount !== 1 ? 's' : ''}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(item);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Material' : 'Add Material'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="2x4 Stud 8ft"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.filter((cat) => cat).map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Unit</Label>
                <Select
                  value={formData.default_unit}
                  onValueChange={(v) => setFormData({ ...formData, default_unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="SF">SF</SelectItem>
                    <SelectItem value="LF">LF</SelectItem>
                    <SelectItem value="sheet">Sheet</SelectItem>
                    <SelectItem value="board_foot">Board Foot</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="roll">Roll</SelectItem>
                    <SelectItem value="gallon">Gallon</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="bag">Bag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Panel */}
      <MaterialDetailPanel
        item={selectedItem}
        open={showDetailPanel}
        onOpenChange={setShowDetailPanel}
      />
    </div>
  );
}
