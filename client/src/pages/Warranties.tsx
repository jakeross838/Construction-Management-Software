import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, FileText, AlertTriangle, Plus } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';

const warranties = [
  { id: '1', jobId: '3', item: 'Roofing System', vendor: 'XYZ Roofing', duration: '25 years', startDate: '2025-11-15', endDate: '2050-11-15', status: 'active' },
  { id: '2', jobId: '3', item: 'HVAC System', vendor: 'Coastal HVAC', duration: '10 years', startDate: '2025-11-15', endDate: '2035-11-15', status: 'active' },
  { id: '3', jobId: '3', item: 'Appliances', vendor: 'Various', duration: '1-5 years', startDate: '2025-11-15', endDate: '2030-11-15', status: 'active' },
  { id: '4', jobId: '3', item: 'Windows & Doors', vendor: 'Premium Windows', duration: '20 years', startDate: '2025-11-15', endDate: '2045-11-15', status: 'active' },
  { id: '5', jobId: '4', item: 'Roofing System', vendor: 'ABC Roofing', duration: '25 years', startDate: '2026-01-15', endDate: '2051-01-15', status: 'pending' },
  { id: '6', jobId: '1', item: 'Foundation', vendor: 'Foundation Co', duration: '10 years', startDate: '2026-02-01', endDate: '2036-02-01', status: 'active' },
  { id: '7', jobId: '2', item: 'Plumbing', vendor: 'Pro Plumbers', duration: '5 years', startDate: '2026-01-10', endDate: '2031-01-10', status: 'active' },
];

const Warranties = () => {
  const { selectedJobId } = useJob();
  
  const filteredWarranties = useMemo(() => {
    if (!selectedJobId) return warranties;
    return warranties.filter(w => w.jobId === selectedJobId);
  }, [selectedJobId]);
  
  const stats = { total: filteredWarranties.length, active: filteredWarranties.filter(w => w.status === 'active').length };
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h1 className="text-2xl font-semibold">Warranties</h1><p className="text-sm text-muted-foreground">Track warranty information and expiration dates</p></div>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Warranty</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card border-l-4 border-l-green-500"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Active Warranties</p><p className="text-2xl font-semibold">{stats.active}</p></div><Shield className="h-8 w-8 text-green-500" /></div></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-blue-500"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Warranties</p><p className="text-2xl font-semibold">{stats.total}</p></div><FileText className="h-8 w-8 text-blue-500" /></div></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-amber-500"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-semibold">0</p></div><AlertTriangle className="h-8 w-8 text-amber-500" /></div></CardContent></Card>
        </div>
        <Card><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Vendor</TableHead><TableHead>Duration</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
          {filteredWarranties.map(w => <TableRow key={w.id}><TableCell className="font-medium">{w.item}</TableCell><TableCell>{w.vendor}</TableCell><TableCell>{w.duration}</TableCell><TableCell>{new Date(w.endDate).toLocaleDateString()}</TableCell><TableCell><Badge variant={w.status === 'active' ? 'default' : 'secondary'}>{w.status}</Badge></TableCell></TableRow>)}
        </TableBody></Table></Card>
      </div>
    </AppLayout>
  );
};

export default Warranties;
