import type { Job } from '@/types/job';
import { getJobCosts, getJobChangeOrders, getJobTimeEntries, getJobDocuments, getJobNotes, getJobActivities } from '@/data/mockJobs';
import { JobDetailHeader } from './detail/JobDetailHeader';
import { JobOverview } from './detail/JobOverview';
import { BudgetTracking } from './detail/BudgetTracking';
import { TimeTracking } from './detail/TimeTracking';
import { DocumentsAndNotes } from './detail/DocumentsAndNotes';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function JobDetail({ job, onBack, onEdit, onDelete }: JobDetailProps) {
  const costs = getJobCosts(job.id);
  const changeOrders = getJobChangeOrders(job.id);
  const timeEntries = getJobTimeEntries(job.id);
  const documents = getJobDocuments(job.id);
  const notes = getJobNotes(job.id);
  const activities = getJobActivities(job.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <JobDetailHeader job={job} onBack={onBack} onEdit={onEdit} onDelete={onDelete} />
      <JobOverview job={job} />
      <BudgetTracking costs={costs} changeOrders={changeOrders} />
      <TimeTracking 
        entries={timeEntries} 
        totalHours={job.laborHours} 
        estimatedHours={job.estimatedHours} 
      />
      <DocumentsAndNotes 
        documents={documents} 
        notes={notes} 
        activities={activities} 
      />
    </div>
  );
}
