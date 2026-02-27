'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { ProcurementPreview } from '@/components/skeleton/previews/procurement-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ProcurementPage(): React.ReactElement {
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
        <ProcurementPreview />
      ) : (
        <PageSpec
          title="Procurement & Supply Chain"
          phase="Phase 2 - Intelligence"
          planFile="docs/modules/18-purchase-orders.md"
          description="PO workflows from takeoff to delivery to invoice match. Delivery tracking, vendor compliance, order consolidation, and AI-powered supply chain optimization."
          workflow={['Takeoff generates material list', 'One-click PO creation from takeoff', 'AI suggests preferred vendors', 'Track deliveries on calendar', 'Mobile receiving with photo verification', 'Auto-match to invoice on arrival']}
          features={['PO from takeoff (1-click)', 'Delivery calendar across all jobs', 'Mobile delivery receiving app', 'Backorder tracking with schedule impact', 'AI vendor auto-suggest', 'Order consolidation for delivery savings', 'Lead time calendar', 'Vendor compliance dashboard', 'Surplus material marketplace']}
          connections={[
            { name: 'Plan Analysis', type: 'input', description: 'Takeoffs feed PO quantities' },
            { name: 'Schedule', type: 'bidirectional', description: 'Deliveries link to schedule tasks' },
            { name: 'Budget', type: 'output', description: 'POs committed against budget lines' },
          ]}
          aiFeatures={[
            { name: 'Order Consolidation', description: 'Groups POs across jobs to same vendor for delivery fee savings' },
            { name: 'Preferred Vendor Matching', description: 'Suggests best vendor based on reliability, pricing, and compliance history' },
            { name: 'Lead Time Intelligence', description: 'Tracks actual lead times and adjusts order-by dates automatically' },
          ]}
        />
      )}
    </div>
  )
}
