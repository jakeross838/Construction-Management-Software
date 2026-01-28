import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Plus, 
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useVendors, useDeleteVendor, getVendorStatus, type Vendor } from '@/hooks/useVendors';
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  active: { label: 'Active', variant: 'default', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  expiring: { label: 'Expiring Soon', variant: 'destructive', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  expired: { label: 'Expired', variant: 'outline', icon: <XCircle className="h-3.5 w-3.5" /> },
  inactive: { label: 'Inactive', variant: 'secondary', icon: null },
};

const Vendors = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useVendors();
  const deleteMutation = useDeleteVendor();

  const vendorsWithStatus = useMemo(() => {
    return vendors.map(v => ({
      ...v,
      computedStatus: getVendorStatus(v.insurance_expiry),
    }));
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendorsWithStatus.filter(vendor => {
      const matchesSearch = !searchQuery.trim() ||
        vendor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || vendor.computedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vendorsWithStatus, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: vendorsWithStatus.length,
    active: vendorsWithStatus.filter(v => v.computedStatus === 'active').length,
    expiring: vendorsWithStatus.filter(v => v.computedStatus === 'expiring').length,
    expired: vendorsWithStatus.filter(v => v.computedStatus === 'expired').length,
  }), [vendorsWithStatus]);

  const handleAdd = () => {
    setEditingVendor(null);
    setFormOpen(true);
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const vendorToDelete = deleteId ? vendors.find(v => v.id === deleteId) : null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Vendors</h1>
            <p className="text-sm text-muted-foreground">Manage trade partners and subcontractors</p>
          </div>
          <Button className="gap-2" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <Truck className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-semibold">{stats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  <p className="text-2xl font-semibold">{stats.expiring}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Insurance expires within 30 days</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-semibold">{stats.expired}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vendors Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Insurance Expires</TableHead>
                <TableHead>W9</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? 'No vendors match your search' : 'No vendors found. Add your first vendor.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => {
                  const config = statusConfig[vendor.computedStatus] || statusConfig.active;
                  return (
                    <TableRow 
                      key={vendor.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(vendor)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.name}</div>
                          {vendor.contact_name && (
                            <div className="text-sm text-muted-foreground">{vendor.contact_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {vendor.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{vendor.email}</span>
                            </div>
                          )}
                          {vendor.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{vendor.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.insurance_expiry ? (
                          <span className={vendor.computedStatus === 'expired' ? 'text-red-600' : vendor.computedStatus === 'expiring' ? 'text-amber-600' : ''}>
                            {new Date(vendor.insurance_expiry).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.w9_on_file ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">On File</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Missing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(vendor); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDeleteId(vendor.id); }}
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
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <VendorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={editingVendor}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{vendorToDelete?.name}</strong>? 
              This action cannot be undone. The vendor may be linked to purchase orders or invoices.
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
    </AppLayout>
  );
};

export default Vendors;
