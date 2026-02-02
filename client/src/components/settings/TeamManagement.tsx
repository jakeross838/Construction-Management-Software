import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  UserCog,
  Mail,
  Loader2,
  Shield,
  AlertCircle,
} from 'lucide-react';
import {
  useTeamMembers,
  useRoles,
  useInviteTeamMember,
  useUpdateMemberRole,
  useRemoveTeamMember,
  useHasPermission,
  TeamMember,
  Role,
} from '@/hooks/useRoles';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export function TeamManagement() {
  const { toast } = useToast();
  const canInvite = useHasPermission('team.invite');
  const canManage = useHasPermission('team.manage');
  const canRemove = useHasPermission('team.remove');

  const { data: members = [], isLoading: loadingMembers } = useTeamMembers();
  const { data: roles = [], isLoading: loadingRoles } = useRoles();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const inviteMember = useInviteTeamMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveTeamMember();

  const getRoleBadgeColor = (roleName?: string) => {
    switch (roleName) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'project_manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'superintendent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'accountant':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'field_worker':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return '';
    }
  };

  const handleInvite = async (data: { email: string; firstName: string; lastName: string; roleId: string }) => {
    try {
      await inviteMember.mutateAsync({
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        role_id: data.roleId,
      });
      toast({ title: 'Invitation Sent', description: `Invitation sent to ${data.email}` });
      setShowInviteDialog(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (roleId: string) => {
    if (!selectedMember) return;
    try {
      await updateRole.mutateAsync({
        userId: selectedMember.id,
        roleId,
      });
      toast({ title: 'Role Updated', description: `Updated role for ${selectedMember.email}` });
      setShowRoleDialog(false);
      setSelectedMember(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to remove ${member.email} from the team?`)) return;
    try {
      await removeMember.mutateAsync(member.id);
      toast({ title: 'Member Removed', description: `${member.email} has been removed from the team` });
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  if (loadingMembers || loadingRoles) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roles.length}</p>
                <p className="text-sm text-muted-foreground">Available Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <UserCog className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members.filter(m => m.role?.name === 'owner' || m.role?.name === 'admin').length}
                </p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage your team and their access levels</CardDescription>
          </div>
          {canInvite && (
            <Button onClick={() => setShowInviteDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No team members yet</p>
              {canInvite && (
                <Button variant="outline" className="mt-4" onClick={() => setShowInviteDialog(true)}>
                  Invite your first team member
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {member.first_name || member.last_name
                            ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                            : member.email}
                        </p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getRoleBadgeColor(member.role?.name)}>
                        {member.role?.display_name || 'No Role'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.last_sign_in_at
                        ? formatDistanceToNow(new Date(member.last_sign_in_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {(canManage || canRemove) && member.role?.name !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManage && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setShowRoleDialog(true);
                                }}
                              >
                                <UserCog className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                            )}
                            {canRemove && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleRemove(member)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Descriptions</CardTitle>
          <CardDescription>Understanding team roles and their capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles
              .filter(r => r.name !== 'client')
              .map((role) => (
                <div key={role.id} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className={getRoleBadgeColor(role.name)}>
                      {role.display_name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <InviteDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        roles={roles}
        onInvite={handleInvite}
        isLoading={inviteMember.isPending}
      />

      {/* Change Role Dialog */}
      <ChangeRoleDialog
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        member={selectedMember}
        roles={roles}
        onChangeRole={handleRoleChange}
        isLoading={updateRole.isPending}
      />
    </div>
  );
}

// Invite Dialog Component
function InviteDialog({
  open,
  onOpenChange,
  roles,
  onInvite,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onInvite: (data: { email: string; firstName: string; lastName: string; roleId: string }) => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState('');

  const handleSubmit = () => {
    if (!email) return;
    onInvite({ email, firstName, lastName, roleId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles
                  .filter(r => r.name !== 'owner' && r.name !== 'client')
                  .map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!email || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Mail className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Change Role Dialog Component
function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  roles,
  onChangeRole,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  roles: Role[];
  onChangeRole: (roleId: string) => void;
  isLoading: boolean;
}) {
  const [roleId, setRoleId] = useState(member?.role?.id || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update the role for {member?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>New Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles
                  .filter(r => r.name !== 'client')
                  .map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Changing a user's role will immediately affect their access permissions.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onChangeRole(roleId)} disabled={!roleId || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TeamManagement;
