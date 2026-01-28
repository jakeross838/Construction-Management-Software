import { LeadStage } from '@/types/job';

// Extended lead type with more fields for the full CRM
export interface LeadFull {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  source: 'referral' | 'website' | 'zillow' | 'social' | 'other';
  estimatedValue: number;
  stage: LeadStage;
  daysInStage: number;
  createdAt: string;
  updatedAt: string;
  projectType?: 'new_construction' | 'remodel' | 'addition' | 'renovation' | 'other';
  projectDescription?: string;
  projectAddress?: string;
  squareFeet?: number;
  notes?: string;
  nextFollowUp?: string;
  assignedTo?: string;
}

export const stageConfig: { id: LeadStage; label: string; color: string }[] = [
  { id: 'new_inquiry', label: 'New Leads', color: 'bg-blue-500' },
  { id: 'qualifying', label: 'Qualifying', color: 'bg-amber-500' },
  { id: 'site_visit', label: 'Site Visit', color: 'bg-purple-500' },
  { id: 'estimating', label: 'Estimating', color: 'bg-indigo-500' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'bg-orange-500' },
  { id: 'negotiating', label: 'Negotiating', color: 'bg-pink-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-400' },
];

export const sourceConfig: Record<string, { label: string; color: string }> = {
  referral: { label: 'Referral', color: 'bg-green-100 text-green-700' },
  website: { label: 'Website', color: 'bg-blue-100 text-blue-700' },
  zillow: { label: 'Zillow', color: 'bg-red-100 text-red-700' },
  social: { label: 'Social', color: 'bg-purple-100 text-purple-700' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700' },
};

export const projectTypeOptions = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'addition', label: 'Addition' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'other', label: 'Other' },
];

export const sourceOptions = [
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'zillow', label: 'Zillow' },
  { value: 'social', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

export const mockLeads: LeadFull[] = [
  {
    id: '1',
    name: 'Johnson Family',
    email: 'johnson@email.com',
    phone: '941-555-1234',
    address: '123 Main St, Sarasota, FL 34236',
    source: 'referral',
    estimatedValue: 1200000,
    stage: 'new_inquiry',
    daysInStage: 2,
    createdAt: '2026-01-21',
    updatedAt: '2026-01-21',
    projectType: 'new_construction',
    projectDescription: 'Custom 4BR/3BA single-story home with pool',
    projectAddress: '501 Gulf View Dr, Sarasota, FL 34242',
    squareFeet: 4200,
    assignedTo: 'Jake Ross',
    nextFollowUp: '2026-01-24',
    notes: 'Very interested, referred by the Crews family.',
  },
  {
    id: '2',
    name: 'Martinez Build',
    email: 'carlos.martinez@email.com',
    phone: '941-555-5678',
    source: 'website',
    estimatedValue: 2100000,
    stage: 'qualifying',
    daysInStage: 1,
    createdAt: '2026-01-22',
    updatedAt: '2026-01-22',
    projectType: 'new_construction',
    projectDescription: 'Modern contemporary 5,800 SF two-story',
    squareFeet: 5800,
    assignedTo: 'Jake Ross',
  },
  {
    id: '3',
    name: 'Thompson Project',
    email: 'thompson@email.com',
    phone: '941-555-9012',
    source: 'website',
    estimatedValue: 800000,
    stage: 'site_visit',
    daysInStage: 5,
    createdAt: '2026-01-18',
    updatedAt: '2026-01-20',
    projectType: 'addition',
    projectDescription: 'Master suite addition and garage expansion',
    squareFeet: 1200,
    assignedTo: 'Sarah Chen',
  },
  {
    id: '4',
    name: 'Garcia Custom Home',
    email: 'garcia.family@email.com',
    phone: '941-555-3456',
    source: 'referral',
    estimatedValue: 950000,
    stage: 'estimating',
    daysInStage: 12,
    createdAt: '2026-01-11',
    updatedAt: '2026-01-20',
    projectType: 'new_construction',
    projectDescription: 'Transitional style custom home, 3,800 SF',
    squareFeet: 3800,
    assignedTo: 'Mike Johnson',
  },
  {
    id: '5',
    name: 'Roberts Estate',
    email: 'roberts@email.com',
    phone: '941-555-7890',
    source: 'website',
    estimatedValue: 1500000,
    stage: 'proposal_sent',
    daysInStage: 3,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-20',
    projectType: 'new_construction',
    projectDescription: 'Luxury estate home with guest house',
    squareFeet: 7500,
    assignedTo: 'Jake Ross',
  },
  {
    id: '6',
    name: 'Anderson Build',
    email: 'anderson@email.com',
    phone: '941-555-2345',
    source: 'referral',
    estimatedValue: 1800000,
    stage: 'won',
    daysInStage: 0,
    createdAt: '2026-01-05',
    updatedAt: '2026-01-23',
    projectType: 'new_construction',
    projectDescription: 'Coastal modern home on waterfront lot',
    squareFeet: 5200,
    assignedTo: 'Jake Ross',
  },
];

export function getNextStage(currentStage: LeadStage): LeadStage | null {
  const order: LeadStage[] = ['new_inquiry', 'qualifying', 'site_visit', 'estimating', 'proposal_sent', 'negotiating', 'won'];
  const currentIndex = order.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === order.length - 1) return null;
  return order[currentIndex + 1];
}
