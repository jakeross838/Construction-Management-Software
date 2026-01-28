import { taskColorLegend } from '@/hooks/useScheduleTasks';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';

export function ScheduleColorLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Legend</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-1">
          <h4 className="font-medium text-sm mb-3">Color Legend</h4>
          <div className="grid gap-2">
            {taskColorLegend.map((item) => (
              <div key={item.type} className="flex items-center gap-3">
                <div 
                  className="h-3 w-6 rounded-sm shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
