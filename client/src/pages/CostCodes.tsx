import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit, Trash2, Filter, Upload, Download } from 'lucide-react';
import { useCostCodes, type CostCode } from '@/hooks/useCostCodes';
import { useDeleteCostCode, useBulkImportCostCodes } from '@/hooks/useCostCodeMutations';
import { CSVImportDialog } from '@/components/data/CSVImportDialog';
import { ExportButton } from '@/components/data/ExportButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CostCodeFormDialog } from '@/components/cost-codes/CostCodeFormDialog';
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

const CostCodes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: costCodes = [], isLoading } = useCostCodes();
  const deleteMutation = useDeleteCostCode();
  const bulkImport = useBulkImportCostCodes();

  const categories = [...new Set(costCodes.map(c => c.category).filter(Boolean))] as string[];
  
  const filtered = costCodes.filter(c => {
    if (!c.code) return false; // Skip entries without code
    const matchesSearch = !searchQuery.trim() ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;

    const isChangeCode = c.code.endsWith('C');
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'base' && !isChangeCode) ||
      (typeFilter === 'change' && isChangeCode);

    return matchesSearch && matchesCategory && matchesType;
  });

  const baseCodes = costCodes.filter(c => c.code && !c.code.endsWith('C'));
  const changeCodes = costCodes.filter(c => c.code && c.code.endsWith('C'));

  const handleEdit = (costCode: CostCode) => {
    setEditingCode(costCode);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingCode(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const codeToDelete = deleteId ? costCodes.find(c => c.id === deleteId) : null;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Cost Codes</h1>
            <p className="text-sm text-muted-foreground">Manage cost code structure for job costing</p>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={costCodes}
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'category', label: 'Category' },
                { key: 'description', label: 'Description' },
              ]}
              filename="cost-codes"
            />
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button className="gap-2" onClick={handleAdd}>
              <Plus className="h-4 w-4" />Add Cost Code
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Cost Codes</p>
              <p className="text-2xl font-semibold">{isLoading ? '...' : costCodes.length}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Base Codes</p>
              <p className="text-2xl font-semibold">{isLoading ? '...' : baseCodes.length}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Change Codes</p>
              <p className="text-2xl font-semibold">{isLoading ? '...' : changeCodes.length}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-semibold">{isLoading ? '...' : categories.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search cost codes..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9" 
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="base">Base Codes</SelectItem>
              <SelectItem value="change">Change Codes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No cost codes found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.code?.endsWith('C') ? 'secondary' : 'default'}>
                        {c.code?.endsWith('C') ? 'Change' : 'Base'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(c)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {costCodes.length} cost codes
        </p>
      </div>

      <CostCodeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        costCode={editingCode}
        categories={categories}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cost Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cost code <strong>{codeToDelete?.code}</strong> ({codeToDelete?.name})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CSVImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Cost Codes"
        description="Upload a CSV file to import cost codes in bulk."
        templateColumns={[
          { key: 'code', label: 'Code', required: true },
          { key: 'name', label: 'Name', required: true },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description' },
        ]}
        validationRules={[
          { field: 'code', required: true },
          { field: 'name', required: true },
        ]}
        sampleData={[
          { code: '01000', name: 'General Requirements', category: 'General', description: 'Project-wide requirements' },
          { code: '03000', name: 'Concrete', category: 'Structure', description: 'Concrete work' },
          { code: '06100', name: 'Rough Carpentry', category: 'Framing', description: 'Wood framing' },
        ]}
        onImport={async (data) => {
          await bulkImport.mutateAsync(
            data.map(row => ({
              code: row.code,
              name: row.name,
              category: row.category || null,
              description: row.description || null,
              is_active: true,
            }))
          );
        }}
      />
    </AppLayout>
  );
};

export default CostCodes;
