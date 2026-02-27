'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { BiddingEstimatingPreview } from '@/components/skeleton/previews/bidding-estimating-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BiddingPage(): React.ReactElement {
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
        <BiddingEstimatingPreview />
      ) : (
        <PageSpec
          title="Bidding & Estimating"
          phase="Phase 2 - Intelligence"
          planFile="docs/modules/26-bid-management.md"
          description="AI-powered bid analysis, scope gap detection, value engineering, and intelligent estimating. Build bid packages, level bids, and generate accurate estimates with AI assistance."
          workflow={['Create bid package with relevant plans and scope', 'Invite subs via portal', 'Receive and level bids side-by-side', 'AI detects scope gaps and flags issues', 'Award bid and generate contract', 'Convert estimate to contract with one click']}
          features={['Bid package builder with auto plan selection', 'Sub bidding portal', 'Side-by-side bid leveling', 'AI scope gap detection', 'Historical bid database', 'Value engineering suggestions', 'Contingency calculator based on project risk', 'Estimate presentation mode', 'Escalation forecasting']}
          connections={[
            { name: 'Plan Analysis', type: 'input', description: 'Takeoffs inform bid scope and quantities' },
            { name: 'Vendor Management', type: 'bidirectional', description: 'Bid history feeds vendor performance scores' },
            { name: 'Contracts', type: 'output', description: 'Awarded bids convert to subcontracts' },
          ]}
          aiFeatures={[
            { name: 'AI Bid Analysis', description: 'Reads bids and summarizes true cost differences including exclusions' },
            { name: 'Scope Gap Detection', description: 'Compares each bid against scope letter to find missing items' },
            { name: 'Value Engineering', description: 'Suggests cost-saving alternatives with minimal visual/quality impact' },
          ]}
        />
      )}
    </div>
  )
}
