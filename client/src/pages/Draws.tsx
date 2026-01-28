import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useDraws } from '@/hooks/useFinancialData';
import { DrawStats } from '@/components/draws/DrawStats';
import { DrawTable } from '@/components/draws/DrawTable';
import { DrawDetailPanel } from '@/components/draws/DrawDetailPanel';
import { DrawFormDialog } from '@/components/draws/DrawFormDialog';
import type { Draw } from '@/types/financial';

const Draws = () => {
  const { selectedJobId } = useJob();
  const { data: draws = [], isLoading } = useDraws(selectedJobId || undefined);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredDraws = useMemo(() => {
    return draws.filter(draw => {
      const matchesSearch = !searchQuery.trim() || 
        (draw.job_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        `Draw ${draw.draw_number}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || draw.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [draws, searchQuery, statusFilter]);

  const handleSelectDraw = (draw: Draw) => {
    setSelectedDrawId(draw.id);
    setIsDetailOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] gap-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Draws</h1>
            <p className="text-sm text-muted-foreground">
              Manage G702/G703 draw requests and funding
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Draw
          </Button>
        </div>

        {/* Stats */}
        <div className="shrink-0">
          <DrawStats draws={draws} />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search draws..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading draws...
            </div>
          ) : (
            <DrawTable
              draws={filteredDraws}
              selectedDrawId={selectedDrawId}
              onSelectDraw={handleSelectDraw}
            />
          )}
        </div>
      </div>

      {/* Draw Detail Dialog */}
      <DrawDetailPanel
        drawId={selectedDrawId}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      {/* Create Draw Dialog */}
      <DrawFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
    </AppLayout>
  );
};

export default Draws;
