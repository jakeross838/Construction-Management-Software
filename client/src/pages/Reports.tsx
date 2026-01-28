import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Play, 
  Clock, 
  Calendar,
  Users,
  Truck,
  ClipboardList,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  FileText,
  Receipt,
  Wallet,
  ArrowUpDown,
  Building2,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useJob } from '@/contexts/JobContext';
import { jobs } from '@/data/mockData';
import { generateReport, ReportFormat } from '@/lib/reportGenerator';

interface Report {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'ready' | 'scheduled' | 'recent';
  lastRun?: string;
  schedule?: string;
  jobSpecific?: boolean;
}

const operationsReports: Report[] = [
  { id: 'labor-hours', name: 'Labor Hours Summary', description: 'Weekly breakdown of labor hours by job and employee', icon: Clock, category: 'ready', jobSpecific: true },
  { id: 'daily-log-summary', name: 'Daily Log Summary', description: 'Compilation of daily logs with weather and notes', icon: ClipboardList, category: 'ready', jobSpecific: true },
  { id: 'schedule-variance', name: 'Schedule Variance', description: 'Compare planned vs actual task completion', icon: Calendar, category: 'ready', jobSpecific: true },
  { id: 'crew-productivity', name: 'Crew Productivity', description: 'Analyze crew output and efficiency metrics', icon: Users, category: 'scheduled', schedule: 'Weekly - Mondays', jobSpecific: true },
  { id: 'material-usage', name: 'Material Usage', description: 'Track material consumption vs estimates', icon: Truck, category: 'ready', jobSpecific: true },
  { id: 'change-order-log', name: 'Change Order Log', description: 'Complete log of all change orders by job', icon: FileText, category: 'recent', lastRun: '2 days ago', jobSpecific: true },
  { id: 'subcontractor-performance', name: 'Subcontractor Performance', description: 'Rate and review sub performance by job', icon: Building2, category: 'ready', jobSpecific: true },
  { id: 'task-completion', name: 'Task Completion Rate', description: 'Tasks completed on-time vs delayed', icon: ClipboardList, category: 'recent', lastRun: '5 days ago', jobSpecific: true },
];

const financialReports: Report[] = [
  { id: 'pnl', name: 'Profit & Loss Statement', description: 'Complete P&L with revenue, costs, and margins', icon: TrendingUp, category: 'ready', jobSpecific: true },
  { id: 'job-cost', name: 'Job Cost Report', description: 'Detailed cost breakdown by job and cost code', icon: DollarSign, category: 'ready', jobSpecific: true },
  { id: 'budget-variance', name: 'Budget vs Actual', description: 'Compare budgeted amounts to actual spend', icon: ArrowUpDown, category: 'scheduled', schedule: 'Monthly - 1st', jobSpecific: true },
  { id: 'cash-flow', name: 'Cash Flow Projection', description: 'Projected cash flow based on draws and payables', icon: Wallet, category: 'ready', jobSpecific: true },
  { id: 'ar-aging', name: 'A/R Aging Report', description: 'Outstanding receivables by age bucket', icon: Receipt, category: 'ready', jobSpecific: true },
  { id: 'ap-aging', name: 'A/P Aging Report', description: 'Outstanding payables by vendor and due date', icon: Receipt, category: 'recent', lastRun: '1 day ago', jobSpecific: true },
  { id: 'overhead-allocation', name: 'Overhead Allocation', description: 'Overhead costs allocated to active jobs', icon: PieChart, category: 'scheduled', schedule: 'Monthly - 15th' },
  { id: 'profitability', name: 'Job Profitability Analysis', description: 'Compare profit margins across all jobs', icon: BarChart3, category: 'recent', lastRun: '3 days ago', jobSpecific: true },
  { id: 'wip', name: 'Work in Progress (WIP)', description: 'WIP schedule for revenue recognition', icon: FileText, category: 'ready', jobSpecific: true },
];

const categoryConfig = {
  ready: { label: 'Ready to Run', color: 'bg-green-500' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500' },
  recent: { label: 'Recently Run', color: 'bg-purple-500' },
};

const Reports = () => {
  const { selectedJobId } = useJob();
  const [activeTab, setActiveTab] = useState('operations');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  const handleRunReport = (report: Report) => {
    setSelectedReport(report);
    setIsDialogOpen(true);
  };

  const handleDownload = async (format: ReportFormat) => {
    if (!selectedReport) return;
    
    setIsGenerating(true);
    const jobInfo = selectedJob ? selectedJob.name : 'All Jobs';
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      generateReport(selectedReport.id, selectedReport.name, format, selectedJobId);
      
      toast.success(`${selectedReport.name} downloaded!`, {
        description: `${format.toUpperCase()} report for ${jobInfo}`,
      });
      
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Failed to generate report', {
        description: 'Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportColumn = (reports: Report[], category: 'ready' | 'scheduled' | 'recent') => {
    const filtered = reports.filter(r => r.category === category);
    const config = categoryConfig[category];

    return (
      <div className="flex-1 min-w-[280px]">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${config.color}`} />
          <h3 className="font-semibold text-sm">{config.label}</h3>
          <Badge variant="secondary" className="ml-auto">{filtered.length}</Badge>
        </div>
        <div className="space-y-3">
          {filtered.map((report) => {
            const IconComponent = report.icon;
            return (
              <Card 
                key={report.id} 
                className="hover:shadow-md transition-all cursor-pointer group border-l-4"
                style={{ borderLeftColor: `hsl(var(--primary))` }}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-sm font-medium">{report.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <CardDescription className="text-xs mb-3">{report.description}</CardDescription>
                  <div className="flex items-center justify-between">
                    {report.lastRun && (
                      <span className="text-xs text-muted-foreground">Last run: {report.lastRun}</span>
                    )}
                    {report.schedule && (
                      <span className="text-xs text-muted-foreground">{report.schedule}</span>
                    )}
                    {!report.lastRun && !report.schedule && <span />}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRunReport(report)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderKanbanBoard = (reports: Report[]) => (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {renderReportColumn(reports, 'ready')}
      {renderReportColumn(reports, 'scheduled')}
      {renderReportColumn(reports, 'recent')}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">
              {selectedJob 
                ? `Generating reports for ${selectedJob.name}` 
                : 'Generate and schedule reports across all jobs'}
            </p>
          </div>
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Create Custom Report
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="operations" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Operations
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="mt-6">
            {renderKanbanBoard(operationsReports)}
          </TabsContent>

          <TabsContent value="financial" className="mt-6">
            {renderKanbanBoard(financialReports)}
          </TabsContent>
        </Tabs>
      </div>

      {/* Format Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Report
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.name} {selectedJob ? `for ${selectedJob.name}` : 'for All Jobs'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => handleDownload('pdf')}
              disabled={isGenerating}
            >
              <FileText className="h-8 w-8 text-red-500" />
              <span className="font-medium">PDF</span>
              <span className="text-xs text-muted-foreground">Formatted report</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => handleDownload('excel')}
              disabled={isGenerating}
            >
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <span className="font-medium">Excel</span>
              <span className="text-xs text-muted-foreground">Spreadsheet data</span>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Reports;
