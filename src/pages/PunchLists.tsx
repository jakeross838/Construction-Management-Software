import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';

const punchItems = [
  { id: '1', jobId: '4', room: 'Kitchen', description: 'Touch up paint on cabinet frames', priority: 'low', status: 'pending', assignee: 'Carlos Rodriguez' },
  { id: '2', jobId: '4', room: 'Master Bath', description: 'Caulk gap at shower door', priority: 'medium', status: 'in_progress', assignee: 'Tom Smith' },
  { id: '3', jobId: '4', room: 'Living Room', description: 'Adjust HVAC vent cover alignment', priority: 'low', status: 'completed', assignee: 'Carlos Rodriguez' },
  { id: '4', jobId: '4', room: 'Exterior', description: 'Touch up stucco near garage door', priority: 'high', status: 'pending', assignee: 'Tom Smith' },
  { id: '5', jobId: '4', room: 'Guest Bath', description: 'Replace cracked tile behind toilet', priority: 'high', status: 'in_progress', assignee: 'Carlos Rodriguez' },
  { id: '6', jobId: '1', room: 'Kitchen', description: 'Fix cabinet door alignment', priority: 'medium', status: 'pending', assignee: 'Tom Smith' },
  { id: '7', jobId: '2', room: 'Master Suite', description: 'Touch up trim paint', priority: 'low', status: 'pending', assignee: 'Carlos Rodriguez' },
];

const PunchLists = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    let filtered = punchItems;
    
    if (selectedJobId) {
      filtered = filtered.filter(item => item.jobId === selectedJobId);
    }
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [selectedJobId, searchQuery]);

  const stats = { total: filteredItems.length, pending: filteredItems.filter(i => i.status === 'pending').length, completed: filteredItems.filter(i => i.status === 'completed').length };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Punch Lists</h1>
            <p className="text-sm text-muted-foreground">Manage punch list items for project closeout</p>
          </div>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Item</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card border-l-4 border-l-amber-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-semibold">{stats.pending}</p></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-semibold">{stats.completed}</p></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Items</p><p className="text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="space-y-2">
          {filteredItems.map(item => (
            <Card key={item.id} className="hover:bg-muted/50"><CardContent className="p-4 flex items-center gap-4">
              <Checkbox checked={item.status === 'completed'} />
              <div className="flex-1"><p className={`font-medium ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{item.description}</p><p className="text-sm text-muted-foreground">{item.room} • {item.assignee}</p></div>
              <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}>{item.priority}</Badge>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default PunchLists;
