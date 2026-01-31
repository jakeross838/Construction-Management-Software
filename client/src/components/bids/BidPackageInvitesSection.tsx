import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Trash2, Mail, Phone, CheckCircle2, XCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { useVendors } from '@/hooks/useVendors';
import {
  BidPackageInvite,
  useAddBidPackageInvite,
  useRemoveBidPackageInvite,
  useSendBidPackageInvite,
} from '@/hooks/useBidPackages';

interface BidPackageInvitesSectionProps {
  bidPackageId: string;
  invites: BidPackageInvite[];
}

export function BidPackageInvitesSection({
  bidPackageId,
  invites,
}: BidPackageInvitesSectionProps) {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const { data: vendors = [] } = useVendors();

  const addInvite = useAddBidPackageInvite();
  const removeInvite = useRemoveBidPackageInvite();
  const sendInvite = useSendBidPackageInvite();

  // Filter out already invited vendors
  const invitedVendorIds = new Set(invites.map((i) => i.vendor_id));
  const availableVendors = vendors.filter((v) => !invitedVendorIds.has(v.id));

  const handleAddInvite = () => {
    if (!selectedVendorId) return;
    addInvite.mutate(
      { bid_package_id: bidPackageId, vendor_id: selectedVendorId },
      { onSuccess: () => setSelectedVendorId('') }
    );
  };

  const handleRemoveInvite = (id: string) => {
    if (confirm('Remove this invite?')) {
      removeInvite.mutate({ id, bidPackageId });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Invite */}
      <div className="flex gap-2">
        <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select subcontractor to invite" />
          </SelectTrigger>
          <SelectContent>
            {availableVendors.length === 0 ? (
              <SelectItem value="" disabled>
                All vendors already invited
              </SelectItem>
            ) : (
              availableVendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button onClick={handleAddInvite} disabled={!selectedVendorId || addInvite.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          Invite
        </Button>
      </div>

      {/* Invites List */}
      {invites.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No subcontractors invited yet</p>
          <p className="text-xs">Invite vendors to submit bids</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    invite.declined
                      ? 'bg-red-100 text-red-600'
                      : invite.viewed_at
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {invite.declined ? (
                    <XCircle className="h-4 w-4" />
                  ) : invite.viewed_at ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{invite.vendor_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {invite.vendor_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {invite.vendor_email}
                      </span>
                    )}
                    {invite.vendor_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {invite.vendor_phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {invite.declined ? (
                  <Badge variant="destructive" className="text-xs">
                    Declined
                  </Badge>
                ) : invite.viewed_at ? (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    Viewed
                  </Badge>
                ) : invite.invite_sent ? (
                  <Badge variant="secondary" className="text-xs">
                    Sent
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="text-xs">
                      Pending
                    </Badge>
                    {invite.vendor_email && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => sendInvite.mutate({ inviteId: invite.id, bidPackageId })}
                        disabled={sendInvite.isPending}
                      >
                        <Send className="h-3 w-3" />
                        Send Email
                      </Button>
                    )}
                  </>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => handleRemoveInvite(invite.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
