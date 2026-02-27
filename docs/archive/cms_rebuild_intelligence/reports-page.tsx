'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { SmartReportsPreview } from '@/components/skeleton/previews/smart-reports-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ReportsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'preview' | 'spec'>('preview')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button onClick={() => setActiveTab('preview')} className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors', activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
          <Eye className="h-4 w-4" />UI Preview
        </button>
        <button onClick={() => setActiveTab('spec')} className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors', activeTab === 'spec' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
          <BookOpen className="h-4 w-4" />Specification
        </button>
      </div>
      {activeTab === 'preview' ? (
        <SmartReportsPreview />
      ) : (
        <PageSpec
          title="Smart Reports & Intelligence"
          phase="Phase 2 - Intelligence"
          planFile="docs/modules/19-financial-reporting.md"
          description="AI-generated narrative reports, portfolio health dashboards, cash flow forecasting, and automated report scheduling. Reports that tell a story, not just show numbers."
          workflow={['AI auto-generates weekly owner reports', 'Review narrative + metrics + photos', 'Click send to distribute', 'Schedule recurring reports', 'Monitor portfolio health dashboard']}
          features={['AI narrative report summaries', 'Owner weekly report (auto-generated)', 'Bank draw package compiler', 'Post-job autopsy report', 'Portfolio health dashboard', 'Cash flow forecast (90-day)', 'Labor productivity report', 'Change order trend analysis', 'Schedule adherence tracking', 'Custom KPI dashboard builder']}
          connections={[
            { name: 'All Financial Data', type: 'input', description: 'Pulls from budgets, invoices, draws, payroll' },
            { name: 'Schedule Data', type: 'input', description: 'Schedule adherence and milestone tracking' },
            { name: 'Client Portal', type: 'output', description: 'Reports shared with clients and lenders' },
          ]}
          aiFeatures={[
            { name: 'Narrative Generation', description: 'AI writes human-readable summaries instead of just showing numbers' },
            { name: 'Portfolio Health Scoring', description: 'Single score per job combining budget, schedule, quality, and risk' },
            { name: 'Cash Flow Prediction', description: 'Projects cash position based on draw schedules, payables, and payment patterns' },
          ]}
        />
      )}
    </div>
  )
}
