import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  Mail,
  Calendar,
  MapPin,
  FileText,
  ArrowRightLeft,
  Plus,
  Clock,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { LeadActivity, LeadActivityInsert, useLeadActivities, useAddLeadActivity } from '@/hooks/useDBLeads';
import { formatDistanceToNow } from 'date-fns';

interface ActivityTimelineProps {
  leadId: string;
}

const activityConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
  call: { icon: Phone, label: 'Phone Call', color: 'text-blue-500 bg-blue-50' },
  email: { icon: Mail, label: 'Email', color: 'text-purple-500 bg-purple-50' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'text-green-500 bg-green-50' },
  site_visit: { icon: MapPin, label: 'Site Visit', color: 'text-orange-500 bg-orange-50' },
  note: { icon: FileText, label: 'Note', color: 'text-gray-500 bg-gray-50' },
  status_change: { icon: ArrowRightLeft, label: 'Status Change', color: 'text-amber-500 bg-amber-50' },
};

export function ActivityTimeline({ leadId }: ActivityTimelineProps) {
  const { user } = useAuth();
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User' : 'User';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<LeadActivityInsert>>({
    activity_type: 'call',
    direction: 'outbound',
  });

  const { data: activities = [], isLoading } = useLeadActivities(leadId);
  const addActivity = useAddLeadActivity();

  const handleSubmit = async () => {
    if (!formData.activity_type) return;

    await addActivity.mutateAsync({
      leadId,
      activity: {
        activity_type: formData.activity_type as LeadActivity['activity_type'],
        direction: formData.direction as LeadActivity['direction'],
        subject: formData.subject,
        description: formData.description,
        outcome: formData.outcome,
        duration_minutes: formData.duration_minutes,
        performed_by: userName,
        performed_at: new Date().toISOString(),
      },
    });

    setIsDialogOpen(false);
    setFormData({ activity_type: 'call', direction: 'outbound' });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Activity Timeline
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Loading activities...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activities recorded yet</p>
            <p className="text-xs mt-1">Click "Log Activity" to add the first one</p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            {activities.map((activity) => {
              const config = activityConfig[activity.activity_type] || activityConfig.note;
              const Icon = config.icon;

              return (
                <div key={activity.id} className="relative flex gap-4 pl-2">
                  {/* Icon */}
                  <div className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{config.label}</span>
                      {activity.direction && (
                        <Badge variant="outline" className="text-xs gap-1">
                          {activity.direction === 'outbound' ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3" />
                          )}
                          {activity.direction}
                        </Badge>
                      )}
                      {activity.duration_minutes && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(activity.duration_minutes)}
                        </Badge>
                      )}
                    </div>

                    {activity.subject && (
                      <p className="font-medium text-sm mt-1">{activity.subject}</p>
                    )}

                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {activity.description}
                      </p>
                    )}

                    {activity.outcome && (
                      <p className="text-sm mt-2">
                        <span className="text-muted-foreground">Outcome: </span>
                        {activity.outcome}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(new Date(activity.performed_at), { addSuffix: true })}
                      </span>
                      {activity.performed_by && (
                        <>
                          <span>•</span>
                          <span>{activity.performed_by}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Log Activity Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select
                  value={formData.activity_type}
                  onValueChange={(value) => setFormData({ ...formData, activity_type: value as LeadActivity['activity_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value) => setFormData({ ...formData, direction: value as LeadActivity['direction'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Brief subject line..."
                value={formData.subject || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What happened? Details of the interaction..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 30"
                  value={formData.duration_minutes || ''}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || undefined })}
                />
              </div>

              <div className="space-y-2">
                <Label>Outcome</Label>
                <Input
                  placeholder="e.g., Left voicemail"
                  value={formData.outcome || ''}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={addActivity.isPending}>
              {addActivity.isPending ? 'Logging...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
