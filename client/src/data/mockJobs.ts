import type { Job, CostCategory, ChangeOrder, TimeEntry, JobDocument, JobNote, JobActivity } from '@/types/job';

export const jobs: Job[] = [
  { 
    id: '1', 
    name: 'Lakewood Estate', 
    address: '2847 Lakewood Dr, Austin TX',
    client: 'The Morrison Family',
    status: 'active', 
    budget: 1850000, 
    spent: 892000,
    laborHours: 2840,
    estimatedHours: 5800,
    startDate: '2025-08-15',
    targetCompletion: '2026-04-30',
    margin: 18.2,
    phase: 'Framing'
  },
  { 
    id: '2', 
    name: 'Highland Ranch', 
    address: '156 Highland Ranch Rd, Dripping Springs TX',
    client: 'David & Sarah Chen',
    status: 'active', 
    budget: 2400000, 
    spent: 1620000,
    laborHours: 4120,
    estimatedHours: 6400,
    startDate: '2025-05-01',
    targetCompletion: '2026-02-28',
    margin: 22.4,
    phase: 'Interior Finish'
  },
  { 
    id: '3', 
    name: 'Sunset Bluff', 
    address: '89 Sunset Bluff Ln, Lakeway TX',
    client: 'Anderson Trust',
    status: 'completed', 
    budget: 980000, 
    spent: 842000,
    laborHours: 1920,
    estimatedHours: 2000,
    startDate: '2025-01-10',
    targetCompletion: '2025-11-15',
    margin: 14.1,
    phase: 'Closeout'
  },
  { 
    id: '4', 
    name: 'Cedar Grove', 
    address: '445 Cedar Grove Ave, Bee Cave TX',
    client: 'James & Emily Park',
    status: 'on-hold', 
    budget: 1200000, 
    spent: 180000,
    laborHours: 480,
    estimatedHours: 3200,
    startDate: '2025-11-01',
    targetCompletion: '2026-08-15',
    margin: 16.8,
    phase: 'Foundation'
  },
  { 
    id: '5', 
    name: 'Mountain View', 
    address: '1220 Mountain View Rd, Spicewood TX',
    client: 'The Williams Family',
    status: 'active', 
    budget: 3200000, 
    spent: 2100000,
    laborHours: 5640,
    estimatedHours: 8200,
    startDate: '2025-03-01',
    targetCompletion: '2026-05-30',
    margin: 24.5,
    phase: 'MEP Rough-in'
  },
  { 
    id: '6', 
    name: 'River Oak Estate', 
    address: '78 River Oak Blvd, West Lake Hills TX',
    client: 'Thompson Holdings LLC',
    status: 'planning', 
    budget: 4500000, 
    spent: 45000,
    laborHours: 120,
    estimatedHours: 12000,
    startDate: '2026-02-01',
    targetCompletion: '2027-06-30',
    margin: 20.0,
    phase: 'Pre-Construction'
  },
];

// Cost categories are now fetched from budget_lines joined with cost_codes
// These are kept for backwards compatibility but should not be used
export const costCategories: Record<string, CostCategory[]> = {};

export const changeOrders: Record<string, ChangeOrder[]> = {
  '1': [
    { id: 'co1', number: 'CO-001', description: 'Upgraded kitchen appliances to Wolf/Sub-Zero package', amount: 45000, status: 'approved', submittedDate: '2025-09-15', approvedDate: '2025-09-18' },
    { id: 'co2', number: 'CO-002', description: 'Additional outdoor living space with covered patio', amount: 78000, status: 'approved', submittedDate: '2025-10-02', approvedDate: '2025-10-08' },
    { id: 'co3', number: 'CO-003', description: 'Wine cellar addition in basement', amount: 35000, status: 'pending', submittedDate: '2025-12-15' },
  ],
  '2': [
    { id: 'co1', number: 'CO-001', description: 'Home theater room upgrade', amount: 65000, status: 'approved', submittedDate: '2025-06-20', approvedDate: '2025-06-25' },
    { id: 'co2', number: 'CO-002', description: 'Pool house addition', amount: 120000, status: 'approved', submittedDate: '2025-08-10', approvedDate: '2025-08-18' },
  ],
};

// Time entries with cost_code_id references (should be fetched from database)
export const timeEntries: Record<string, TimeEntry[]> = {
  '1': [
    { id: 't1', jobId: '1', employeeId: 'e1', employeeName: 'Mike Rodriguez', date: '2026-01-22', hours: 8, hourlyRate: 32, burdenRate: 12.80, costCode: '', description: 'Wall framing - second floor' },
    { id: 't2', jobId: '1', employeeId: 'e2', employeeName: 'James Wilson', date: '2026-01-22', hours: 8, hourlyRate: 28, burdenRate: 11.20, costCode: '', description: 'Wall framing - second floor' },
    { id: 't3', jobId: '1', employeeId: 'e3', employeeName: 'Carlos Martinez', date: '2026-01-22', hours: 6, hourlyRate: 35, burdenRate: 14.00, costCode: '', description: 'Rough electrical - first floor' },
    { id: 't4', jobId: '1', employeeId: 'e1', employeeName: 'Mike Rodriguez', date: '2026-01-21', hours: 8, hourlyRate: 32, burdenRate: 12.80, costCode: '', description: 'Wall framing - first floor' },
    { id: 't5', jobId: '1', employeeId: 'e4', employeeName: 'David Thompson', date: '2026-01-21', hours: 4, hourlyRate: 45, burdenRate: 18.00, costCode: '', description: 'Rough plumbing inspection prep' },
  ],
  '2': [
    { id: 't1', jobId: '2', employeeId: 'e5', employeeName: 'Sarah Johnson', date: '2026-01-22', hours: 8, hourlyRate: 38, burdenRate: 15.20, costCode: '', description: 'Cabinet installation - kitchen' },
    { id: 't2', jobId: '2', employeeId: 'e6', employeeName: 'Tom Anderson', date: '2026-01-22', hours: 8, hourlyRate: 42, burdenRate: 16.80, costCode: '', description: 'Trim carpentry - living areas' },
  ],
};

export const jobDocuments: Record<string, JobDocument[]> = {
  '1': [
    { id: 'd1', jobId: '1', name: 'Construction Contract.pdf', type: 'contract', url: '#', uploadedBy: 'Admin', uploadedAt: '2025-08-10', size: 2450000 },
    { id: 'd2', jobId: '1', name: 'Building Permit.pdf', type: 'permit', url: '#', uploadedBy: 'Admin', uploadedAt: '2025-08-12', size: 850000 },
    { id: 'd3', jobId: '1', name: 'Architectural Plans v2.1.pdf', type: 'drawing', url: '#', uploadedBy: 'Sarah M.', uploadedAt: '2025-09-05', size: 15600000 },
    { id: 'd4', jobId: '1', name: 'Foundation Progress.jpg', type: 'photo', url: '#', uploadedBy: 'Mike R.', uploadedAt: '2025-10-15', size: 3200000 },
    { id: 'd5', jobId: '1', name: 'Framing Progress.jpg', type: 'photo', url: '#', uploadedBy: 'Mike R.', uploadedAt: '2025-12-20', size: 2800000 },
  ],
  '2': [
    { id: 'd1', jobId: '2', name: 'Construction Contract.pdf', type: 'contract', url: '#', uploadedBy: 'Admin', uploadedAt: '2025-04-20', size: 2100000 },
    { id: 'd2', jobId: '2', name: 'Building Permit.pdf', type: 'permit', url: '#', uploadedBy: 'Admin', uploadedAt: '2025-04-25', size: 920000 },
  ],
};

export const jobNotes: Record<string, JobNote[]> = {
  '1': [
    { id: 'n1', jobId: '1', author: 'Mike Rodriguez', authorRole: 'PM', content: 'Framing inspection passed. Moving to roof trusses next week.', createdAt: '2026-01-20T14:30:00Z', isPinned: true },
    { id: 'n2', jobId: '1', author: 'Sarah Mitchell', authorRole: 'Admin', content: 'Client approved CO-002 for outdoor living space. Updated budget accordingly.', createdAt: '2025-10-08T09:15:00Z', isPinned: false },
    { id: 'n3', jobId: '1', author: 'Mike Rodriguez', authorRole: 'PM', content: 'Weather delay expected this week due to forecasted rain. Adjusted schedule by 3 days.', createdAt: '2026-01-18T16:45:00Z', isPinned: false },
  ],
  '2': [
    { id: 'n1', jobId: '2', author: 'Tom Anderson', authorRole: 'PM', content: 'Interior finishes on track. Expecting completion by end of February.', createdAt: '2026-01-15T10:00:00Z', isPinned: true },
  ],
};

export const jobActivities: Record<string, JobActivity[]> = {
  '1': [
    { id: 'a1', jobId: '1', type: 'time_entry', description: 'Mike Rodriguez logged 8 hours for wall framing', user: 'Mike Rodriguez', timestamp: '2026-01-22T17:00:00Z' },
    { id: 'a2', jobId: '1', type: 'cost_update', description: 'Framing costs updated: $195,000 actual', user: 'System', timestamp: '2026-01-22T17:05:00Z' },
    { id: 'a3', jobId: '1', type: 'note_added', description: 'New note added about framing inspection', user: 'Mike Rodriguez', timestamp: '2026-01-20T14:30:00Z' },
    { id: 'a4', jobId: '1', type: 'change_order', description: 'CO-003 submitted: Wine cellar addition ($35,000)', user: 'Mike Rodriguez', timestamp: '2025-12-15T11:20:00Z' },
    { id: 'a5', jobId: '1', type: 'document_upload', description: 'Framing Progress.jpg uploaded', user: 'Mike R.', timestamp: '2025-12-20T15:30:00Z' },
  ],
  '2': [
    { id: 'a1', jobId: '2', type: 'time_entry', description: 'Sarah Johnson logged 8 hours for cabinet installation', user: 'Sarah Johnson', timestamp: '2026-01-22T17:00:00Z' },
    { id: 'a2', jobId: '2', type: 'note_added', description: 'New note about interior finishes progress', user: 'Tom Anderson', timestamp: '2026-01-15T10:00:00Z' },
  ],
};

export function getJobById(id: string): Job | undefined {
  return jobs.find(job => job.id === id);
}

export function getJobCosts(jobId: string): CostCategory[] {
  // Return empty array - cost categories should now come from budget_lines
  return costCategories[jobId] || [];
}

export function getJobChangeOrders(jobId: string): ChangeOrder[] {
  return changeOrders[jobId] || [];
}

export function getJobTimeEntries(jobId: string): TimeEntry[] {
  return timeEntries[jobId] || [];
}

export function getJobDocuments(jobId: string): JobDocument[] {
  return jobDocuments[jobId] || [];
}

export function getJobNotes(jobId: string): JobNote[] {
  return jobNotes[jobId] || [];
}

export function getJobActivities(jobId: string): JobActivity[] {
  return jobActivities[jobId] || [];
}
