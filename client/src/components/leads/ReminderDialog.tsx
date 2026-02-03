import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Loader2 } from 'lucide-react';
import { useCreateReminder } from '@/hooks/useLeadNotifications';

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

export function ReminderDialog({ open, onOpenChange, leadId, leadName }: ReminderDialogProps) {
  const createReminder = useCreateReminder();

  const [reminderType, setReminderType] = useState<string>('follow_up');
  const [reminderDate, setReminderDate] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('09:00');
  const [message, setMessage] = useState<string>('');

  // Quick options for reminder time
  const quickOptions = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In 3 days', days: 3 },
    { label: 'In 1 week', days: 7 },
    { label: 'In 2 weeks', days: 14 },
    { label: 'In 1 month', days: 30 },
  ];

  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setReminderDate(date.toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!reminderDate) return;

    const reminderAt = new Date(`${reminderDate}T${reminderTime}`).toISOString();

    await createReminder.mutateAsync({
      lead_id: leadId,
      reminder_type: reminderType,
      reminder_at: reminderAt,
      message: message || undefined,
    });

    // Reset and close
    setReminderDate('');
    setReminderTime('09:00');
    setMessage('');
    setReminderType('follow_up');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Set Reminder
          </DialogTitle>
          <DialogDescription>
            Create a reminder for {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Reminder Type */}
          <div className="space-y-2">
            <Label htmlFor="reminder_type">Reminder Type</Label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Follow-up Call</SelectItem>
                <SelectItem value="custom">Custom Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Date Options */}
          <div className="space-y-2">
            <Label>Quick Set</Label>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.days}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDate(option.days)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reminder_date">Date</Label>
              <Input
                id="reminder_date"
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder_time">Time</Label>
              <Input
                id="reminder_time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Note (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a note for this reminder..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reminderDate || createReminder.isPending}
          >
            {createReminder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Reminder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
