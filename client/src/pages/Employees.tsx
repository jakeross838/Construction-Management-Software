import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Plus, 
  Search, 
  Users, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  Mail,
  Phone,
  UserCheck,
  UserX,
} from 'lucide-react';
import { 
  useEmployees, 
  useCreateEmployee, 
  useUpdateEmployee, 
  useDeleteEmployee,
  Employee 
} from '@/hooks/useEmployees';
import { EmployeeFormDialog } from '@/components/employees/EmployeeFormDialog';
import { toast } from 'sonner';

const Employees = () => {
  const [showInactive, setShowInactive] = useState(false);
  const { data: employees = [], isLoading } = useEmployees(!showInactive);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmEmployee, setDeleteConfirmEmployee] = useState<Employee | null>(null);

  const filteredEmployees = employees.filter(emp => {
    if (!searchQuery.trim()) return true;
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) ||
           emp.email?.toLowerCase().includes(query) ||
           emp.role?.toLowerCase().includes(query);
  });

  const activeCount = employees.filter(e => e.is_active).length;

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleSaveEmployee = async (employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingEmployee) {
        await updateEmployee.mutateAsync({ id: editingEmployee.id, ...employeeData });
        toast.success('Employee updated successfully');
      } else {
        await createEmployee.mutateAsync(employeeData);
        toast.success('Employee added successfully');
      }
    } catch (error) {
      toast.error('Failed to save employee');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteConfirmEmployee) return;
    try {
      await deleteEmployee.mutateAsync(deleteConfirmEmployee.id);
      toast.success('Employee deleted successfully');
      setDeleteConfirmEmployee(null);
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const toggleActive = async (employee: Employee) => {
    try {
      await updateEmployee.mutateAsync({ id: employee.id, is_active: !employee.is_active });
      toast.success(employee.is_active ? 'Employee deactivated' : 'Employee activated');
    } catch {
      toast.error('Failed to update employee status');
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-[500px] w-full" />
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
            <h1 className="text-2xl font-semibold text-foreground">Team Members</h1>
            <p className="text-sm text-muted-foreground">
              Manage employees and team assignments
            </p>
          </div>
          <Button onClick={handleAddEmployee} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {employees.length - activeCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            variant={showInactive ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Showing All' : 'Show Inactive'}
          </Button>
        </div>

        {/* Employees Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {searchQuery ? 'No employees match your search' : 'No employees found. Add your first employee.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(employee => (
                    <TableRow 
                      key={employee.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(employee.first_name, employee.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                            {employee.hourly_rate && (
                              <div className="text-xs text-muted-foreground">
                                ${employee.hourly_rate.toFixed(2)}/hr
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{employee.role || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{employee.department || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {employee.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{employee.email}</span>
                            </div>
                          )}
                          {employee.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                          {employee.is_active ? 'Active' : 'Inactive'}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditEmployee(employee); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleActive(employee); }}>
                              {employee.is_active ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmEmployee(employee); }}
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
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <EmployeeFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employee={editingEmployee}
          onSave={handleSaveEmployee}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmEmployee} onOpenChange={() => setDeleteConfirmEmployee(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deleteConfirmEmployee?.first_name} {deleteConfirmEmployee?.last_name}? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Employees;
