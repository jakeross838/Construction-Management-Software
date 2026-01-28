import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Package, Layers, Check } from 'lucide-react';
import { Assembly, EstimateLineItem, formatCurrencyEstimate, lineItemTypes } from '@/types/estimate';
import { assemblies } from '@/data/mockEstimates';

interface AssemblyPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (lineItems: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>[]) => void;
}

export function AssemblyPicker({ open, onOpenChange, onInsert }: AssemblyPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | null>(null);
  const [quantity, setQuantity] = useState(1);

  const categories = useMemo(() => {
    const cats = new Set(assemblies.map(a => a.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredAssemblies = useMemo(() => {
    return assemblies.filter(assembly => {
      if (!assembly.isActive) return false;
      if (categoryFilter !== 'all' && assembly.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return assembly.name?.toLowerCase().includes(query) ||
               assembly.description?.toLowerCase().includes(query) ||
               assembly.category?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [searchQuery, categoryFilter]);

  const handleSelect = (assembly: Assembly) => {
    setSelectedAssembly(assembly);
    setQuantity(1);
  };

  const handleInsert = () => {
    if (!selectedAssembly) return;

    const lineItems = selectedAssembly.lineItems.map(item => ({
      ...item,
      quantity: item.quantity * quantity,
      assemblyId: selectedAssembly.id,
    }));

    onInsert(lineItems);
    onOpenChange(false);
    setSelectedAssembly(null);
    setQuantity(1);
  };

  const totalCost = selectedAssembly 
    ? selectedAssembly.totalCostPerUnit * quantity 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Insert Assembly
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 flex-1">
          {/* Assembly List */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assemblies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36">
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

            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredAssemblies.map(assembly => (
                  <Card 
                    key={assembly.id}
                    className={`cursor-pointer transition-colors ${
                      selectedAssembly?.id === assembly.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleSelect(assembly)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{assembly.name}</h4>
                            {selectedAssembly?.id === assembly.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {assembly.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {assembly.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {assembly.lineItems.length} items
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-primary">
                            {formatCurrencyEstimate(assembly.totalCostPerUnit)}
                          </p>
                          <p className="text-xs text-muted-foreground">per {assembly.unit}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredAssemblies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No assemblies found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Assembly Detail / Preview */}
          <div className="border rounded-lg p-4">
            {selectedAssembly ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedAssembly.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAssembly.description}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity ({selectedAssembly.unit})</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32"
                  />
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Included Items</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-2">
                      {selectedAssembly.lineItems.map((item, index) => {
                        const typeConfig = lineItemTypes.find(t => t.value === item.type);
                        return (
                          <div key={index} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {typeConfig?.label || item.type}
                              </Badge>
                              <span className="truncate">{item.description}</span>
                            </div>
                            <span className="text-muted-foreground flex-shrink-0 ml-2">
                              {item.quantity * quantity} {item.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Estimated Cost</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrencyEstimate(totalCost)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrencyEstimate(selectedAssembly.totalCostPerUnit)} × {quantity} {selectedAssembly.unit}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="h-12 w-12 mb-3" />
                <p className="text-center">
                  Select an assembly from the list to see details and insert it into your estimate
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!selectedAssembly}>
            Insert Assembly
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
