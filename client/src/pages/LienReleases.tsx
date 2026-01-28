import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Download, Search, MoreHorizontal, Pencil, Trash2, CheckCircle, Filter } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useLienReleases, useDeleteLienRelease, useMarkLienReleaseReceived, type LienRelease } from '@/hooks/useLienReleases';
import { LienReleaseFormDialog } from '@/components/lien-releases/LienReleaseFormDialog';
import { formatCurrency } from '@/types/financial';

const LienReleases = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<LienRelease | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: releases = [], isLoading } = useLienReleases(selectedJobId);
  const deleteMutation = useDeleteLienRelease();
  const markReceivedMutation = useMarkLienReleaseReceived();

  const filteredReleases = useMemo(() => {
    return releases.filter(r => {
      const matchesSearch = !searchQuery.trim() ||
        r.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesType = typeFilter === 'all' || r.release_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [releases, searchQuery, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: releases.length,
    received: releases.filter(l => l.status === 'received').length,
    pending: releases.filter(l => l.status === 'pending' || l.status === 'requested').length,
    totalAmount: releases.reduce((s, l) => s + (l.amount || 0), 0),
  }), [releases]);

  const handleAdd = () => {
    setEditingRelease(null);
    setFormOpen(true);
  };

  const handleEdit = (release: LienRelease) => {
    setEditingRelease(release);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleMarkReceived = async (id: string) => {
    await markReceivedMutation.mutateAsync({ id });
  };

  const releaseToDelete = deleteId ? releases.find(r => r.id === deleteId) : null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Lien Releases</h1>
            <p className="text-sm text-muted-foreground">Manage lien release documents for project closeout</p>
          </div>
          <Button className="gap-2" onClick={handleAdd}>
            <Plus className="h-4 w-4" />Request Release
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Received</p>
              <p className="text-2xl font-semibold">{stats.received}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.totalAmount)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="received">Received</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="conditional">Conditional</SelectItem>
              <SelectItem value="unconditional">Unconditional</SelectItem>
              <SelectItem value="final">Final</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Draw</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Through Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReleases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? 'No lien releases match your search' : 'No lien releases found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReleases.map(r => (
                  <TableRow 
                    key={r.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(r)}
                  >
                    <TableCell className="font-medium">{r.vendor?.name || 'Unknown'}</TableCell>
                    <TableCell>{r.job?.name || '—'}</TableCell>
                    <TableCell>Draw #{r.draw?.draw_number || '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{r.release_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.through_date ? new Date(r.through_date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'received' ? 'default' : 'secondary'} className="capitalize">
                        {r.status}
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(r); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {r.status !== 'received' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkReceived(r.id); }}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark Received
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); /* TODO: Download */ }}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <LienReleaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        release={editingRelease}
        defaultJobId={selectedJobId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lien Release</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the lien release for <strong>{releaseToDelete?.vendor?.name}</strong>? 
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
    </AppLayout>
  );
};

export default LienReleases;
