import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Clock, AlertTriangle, Trophy, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  NotificationPreferences,
} from '@/hooks/useLeadNotifications';

interface NotificationSettingsCardProps {
  userId?: string;
}

export function NotificationSettingsCard({ userId = 'default-user' }: NotificationSettingsCardProps) {
  const { data: preferences, isLoading } = useNotificationPreferences(userId);
  const updatePreferences = useUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<Partial<NotificationPreferences>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleNumberChange = (key: keyof NotificationPreferences, value: number) => {
    setLocalPrefs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updatePreferences.mutate({ ...localPrefs, user_id: userId });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how you receive lead notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notification Channels</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="email_notifications">Email Notifications</Label>
              </div>
              <Switch
                id="email_notifications"
                checked={localPrefs.email_notifications || false}
                onCheckedChange={() => handleToggle('email_notifications')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="in_app_notifications">In-App Notifications</Label>
              </div>
              <Switch
                id="in_app_notifications"
                checked={localPrefs.in_app_notifications || false}
                onCheckedChange={() => handleToggle('in_app_notifications')}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Lead Events */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Lead Events</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                <Label htmlFor="notify_new_lead">New Lead Assigned</Label>
              </div>
              <Switch
                id="notify_new_lead"
                checked={localPrefs.notify_new_lead || false}
                onCheckedChange={() => handleToggle('notify_new_lead')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-purple-500" />
                <Label htmlFor="notify_stage_change">Stage Changes</Label>
              </div>
              <Switch
                id="notify_stage_change"
                checked={localPrefs.notify_stage_change || false}
                onCheckedChange={() => handleToggle('notify_stage_change')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-green-500" />
                <Label htmlFor="notify_lead_won">Lead Won</Label>
              </div>
              <Switch
                id="notify_lead_won"
                checked={localPrefs.notify_lead_won || false}
                onCheckedChange={() => handleToggle('notify_lead_won')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <Label htmlFor="notify_lead_lost">Lead Lost</Label>
              </div>
              <Switch
                id="notify_lead_lost"
                checked={localPrefs.notify_lead_lost || false}
                onCheckedChange={() => handleToggle('notify_lead_lost')}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Follow-up Reminders */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Follow-up Reminders</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <Label htmlFor="notify_follow_up_due">Follow-up Due</Label>
              </div>
              <Switch
                id="notify_follow_up_due"
                checked={localPrefs.notify_follow_up_due || false}
                onCheckedChange={() => handleToggle('notify_follow_up_due')}
              />
            </div>
            {localPrefs.notify_follow_up_due && (
              <div className="flex items-center gap-2 pl-6">
                <Label htmlFor="follow_up_reminder_hours" className="text-sm text-muted-foreground">
                  Remind me
                </Label>
                <Input
                  id="follow_up_reminder_hours"
                  type="number"
                  min={1}
                  max={168}
                  value={localPrefs.follow_up_reminder_hours || 24}
                  onChange={(e) => handleNumberChange('follow_up_reminder_hours', parseInt(e.target.value) || 24)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">hours before</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Stale Lead Alerts */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Stale Lead Alerts</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <Label htmlFor="notify_stale_leads">Stale Lead Warnings</Label>
              </div>
              <Switch
                id="notify_stale_leads"
                checked={localPrefs.notify_stale_leads || false}
                onCheckedChange={() => handleToggle('notify_stale_leads')}
              />
            </div>
            {localPrefs.notify_stale_leads && (
              <div className="flex items-center gap-2 pl-6">
                <Label htmlFor="stale_lead_days" className="text-sm text-muted-foreground">
                  Alert after
                </Label>
                <Input
                  id="stale_lead_days"
                  type="number"
                  min={1}
                  max={90}
                  value={localPrefs.stale_lead_days || 7}
                  onChange={(e) => handleNumberChange('stale_lead_days', parseInt(e.target.value) || 7)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days of inactivity</span>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={updatePreferences.isPending}
              className="w-full"
            >
              {updatePreferences.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
