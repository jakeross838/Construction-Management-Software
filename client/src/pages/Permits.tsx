import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  FileCheck, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Calendar,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  DollarSign
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { usePermits, useDeletePermit, Permit } from '@/hooks/usePermits';
import { PermitFormDialog } from '@/components/permits/PermitFormDialog';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  approved: { 
    label: 'Approved', 
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  pending: { 
    label: 'Pending', 
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    icon: <Clock className="h-4 w-4" />
  },
  submitted: { 
    label: 'Submitted', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: <FileText className="h-4 w-4" />
  },
  in_review: { 
    label: 'In Review', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: <FileText className="h-4 w-4" />
  },
  not_submitted: { 
    label: 'Not Submitted', 
    color: 'bg-muted text-muted-foreground border-border',
    icon: <AlertTriangle className="h-4 w-4" />
  },
  rejected: { 
    label: 'Rejected', 
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: <XCircle className="h-4 w-4" />
  },
  expired: { 
    label: 'Expired', 
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    icon: <AlertTriangle className="h-4 w-4" />
  },
  revoked: { 
    label: 'Revoked', 
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: <XCircle className="h-4 w-4" />
  }
};

export default function Permits() {
  const { selectedJobId } = useJob();
  const { data: permits, isLoading } = usePermits(selectedJobId);
  const deletePermit = useDeletePermit();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [permitToDelete, setPermitToDelete] = useState<Permit | null>(null);

  const filteredPermits = permits?.filter(permit => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return permit.type?.toLowerCase().includes(query) ||
      permit.number?.toLowerCase().includes(query) ||
      permit.jurisdiction?.toLowerCase().includes(query) ||
      permit.jobs?.name?.toLowerCase().includes(query);
  }) || [];

  const stats = {
    total: filteredPermits.length,
    approved: filteredPermits.filter(p => p.status === 'approved').length,
    pending: filteredPermits.filter(p => ['pending', 'submitted', 'in_review'].includes(p.status)).length,
    actionRequired: filteredPermits.filter(p => ['rejected', 'not_submitted', 'expired'].includes(p.status)).length
  };

  const handleEdit = (permit: Permit) => {
    setEditingPermit(permit);
    setDialogOpen(true);
  };

  const handleDelete = (permit: Permit) => {
    setPermitToDelete(permit);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (permitToDelete) {
      await deletePermit.mutateAsync(permitToDelete.id);
      setDeleteConfirmOpen(false);
      setPermitToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingPermit(null);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Permits</h1>
            <p className="text-muted-foreground">
              {selectedJobId ? 'Track permit submissions and approvals for this job' : 'Track permit submissions and approvals across all jobs'}
            </p>
          </div>
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Permit
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Permits</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending/In Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.actionRequired}</p>
                  <p className="text-sm text-muted-foreground">Action Required</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search permits..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Permits List */}
        <Card>
          <CardHeader>
            <CardTitle>All Permits</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredPermits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No permits found</p>
                <p className="text-sm mt-1">Add your first permit to start tracking</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPermits.map((permit) => {
                  const status = statusConfig[permit.status] || statusConfig.not_submitted;
                  return (
                    <div 
                      key={permit.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 rounded-lg bg-muted">
                          <FileCheck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">{permit.type}</h3>
                            {permit.number && (
                              <span className="text-sm text-muted-foreground">#{permit.number}</span>
                            )}
                            {!selectedJobId && permit.jobs && (
                              <Badge variant="outline" className="text-xs">
                                {permit.jobs.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            {permit.jurisdiction && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {permit.jurisdiction}
                              </span>
                            )}
                            {permit.submitted_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Submitted: {new Date(permit.submitted_date).toLocaleDateString()}
                              </span>
                            )}
                            {permit.expires_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires: {new Date(permit.expires_date).toLocaleDateString()}
                              </span>
                            )}
                            {permit.fee_amount && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(permit.fee_amount)}
                                {permit.fee_paid && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                              </span>
                            )}
                          </div>
                          {permit.notes && (
                            <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                              {permit.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`gap-1 ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(permit)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(permit)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <PermitFormDialog 
        open={dialogOpen} 
        onOpenChange={handleDialogClose}
        permit={editingPermit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this permit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
