import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Folder, Download, Upload } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';

const docCategories = [
  { jobId: '3', name: 'As-Built Drawings', required: 3, received: 2, status: 'in_progress' },
  { jobId: '3', name: 'Warranty Documents', required: 8, received: 8, status: 'complete' },
  { jobId: '3', name: 'Lien Releases', required: 12, received: 10, status: 'in_progress' },
  { jobId: '3', name: 'Certificates of Occupancy', required: 1, received: 1, status: 'complete' },
  { jobId: '3', name: 'O&M Manuals', required: 5, received: 3, status: 'in_progress' },
  { jobId: '3', name: 'Inspection Reports', required: 6, received: 6, status: 'complete' },
  { jobId: '4', name: 'As-Built Drawings', required: 4, received: 1, status: 'in_progress' },
  { jobId: '4', name: 'Warranty Documents', required: 6, received: 4, status: 'in_progress' },
  { jobId: '1', name: 'Permits', required: 5, received: 5, status: 'complete' },
  { jobId: '2', name: 'Inspection Reports', required: 4, received: 2, status: 'in_progress' },
];

const FinalDocs = () => {
  const { selectedJobId } = useJob();
  
  const filteredCategories = useMemo(() => {
    if (!selectedJobId) return docCategories;
    return docCategories.filter(c => c.jobId === selectedJobId);
  }, [selectedJobId]);
  
  const totalRequired = filteredCategories.reduce((s, c) => s + c.required, 0);
  const totalReceived = filteredCategories.reduce((s, c) => s + c.received, 0);
  const percentComplete = totalRequired > 0 ? (totalReceived / totalRequired) * 100 : 0;
  
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h1 className="text-2xl font-semibold">Final Documents</h1><p className="text-sm text-muted-foreground">Closeout documentation and handover package</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export Package</Button>
            <Button className="gap-2"><Upload className="h-4 w-4" />Upload Document</Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Documents Received</p><p className="text-2xl font-semibold">{totalReceived} / {totalRequired}</p><Progress value={percentComplete} className="h-2 mt-2" /></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Categories Complete</p><p className="text-2xl font-semibold">{filteredCategories.filter(c => c.status === 'complete').length} / {filteredCategories.length}</p></CardContent></Card>
          <Card className="stat-card border-l-4 border-l-purple-500"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Overall Progress</p><p className="text-2xl font-semibold">{percentComplete.toFixed(0)}%</p></CardContent></Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((cat, idx) => (
            <Card key={`${cat.jobId}-${cat.name}-${idx}`} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Folder className="h-5 w-5 text-primary" />{cat.name}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">{cat.received} of {cat.required} received</span><Badge variant={cat.status === 'complete' ? 'default' : 'secondary'}>{cat.status === 'complete' ? 'Complete' : 'In Progress'}</Badge></div>
                <Progress value={(cat.received / cat.required) * 100} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default FinalDocs;
