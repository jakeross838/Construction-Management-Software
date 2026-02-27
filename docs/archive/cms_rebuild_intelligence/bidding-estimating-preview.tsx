'use client'

import {
  DollarSign,
  Sparkles,
  Package,
  TrendingDown,
  AlertTriangle,
  Users,
  Clock,
  Star,
  Lightbulb,
  FileText,
  Search,
  Calculator,
  Award,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// -- Types --

type BidPackageStatus = 'open' | 'closing_soon' | 'under_review' | 'awarded'

interface BidPackageRow {
  id: string
  trade: string
  biddersInvited: number
  bidsReceived: number
  dueDate: string
  status: BidPackageStatus
}

interface BidderComparison {
  name: string
  baseBid: number
  exclusions: string[]
  scopeGaps: string[]
  recommended: boolean
}

interface ScopeGap {
  id: string
  severity: 'high' | 'medium'
  description: string
  bidder: string
}

interface ValueEngineeringSuggestion {
  id: string
  description: string
  savings: number
  impact: string
}

// -- Mock Data --

const mockStats = [
  { label: 'Active Bids', value: '12', icon: FileText, color: 'bg-stone-50 text-stone-600', valueColor: 'text-stone-700' },
  { label: 'Bid Packages', value: '8', icon: Package, color: 'bg-amber-50 text-amber-600', valueColor: 'text-amber-700' },
  { label: 'Avg Savings', value: '14.2%', icon: TrendingDown, color: 'bg-green-50 text-green-600', valueColor: 'text-green-700' },
  { label: 'Scope Gaps Found', value: '23', icon: AlertTriangle, color: 'bg-red-50 text-red-600', valueColor: 'text-red-700' },
  { label: 'Estimates', value: '18', icon: Calculator, color: 'bg-warm-50 text-warm-600', valueColor: 'text-warm-700' },
]

const mockBidPackages: BidPackageRow[] = [
  { id: '1', trade: 'Electrical Rough-In', biddersInvited: 5, bidsReceived: 4, dueDate: '2026-02-18', status: 'under_review' },
  { id: '2', trade: 'Plumbing Finish', biddersInvited: 4, bidsReceived: 2, dueDate: '2026-02-22', status: 'open' },
  { id: '3', trade: 'HVAC Installation', biddersInvited: 6, bidsReceived: 6, dueDate: '2026-02-10', status: 'awarded' },
  { id: '4', trade: 'Framing Package', biddersInvited: 3, bidsReceived: 3, dueDate: '2026-02-20', status: 'closing_soon' },
]

const mockBidders: BidderComparison[] = [
  {
    name: 'Coastal Framing Co.',
    baseBid: 42800,
    exclusions: ['Cleanup'],
    scopeGaps: [],
    recommended: true,
  },
  {
    name: 'Elite Framers Inc.',
    baseBid: 46200,
    exclusions: ['Hardware', 'Blocking'],
    scopeGaps: ['Missing roof sheathing labor'],
    recommended: false,
  },
  {
    name: 'QuickFrame LLC',
    baseBid: 38500,
    exclusions: ['Sheathing', 'Hardware', 'Cleanup'],
    scopeGaps: ['No mention of engineered lumber', 'Missing second-floor blocking'],
    recommended: false,
  },
]

const mockScopeGaps: ScopeGap[] = [
  { id: '1', severity: 'high', description: 'Plumber B did not include gas line rough-in', bidder: 'Island Plumbing' },
  { id: '2', severity: 'high', description: 'Neither plumbing bidder included water softener loop', bidder: 'All Plumbing Bidders' },
  { id: '3', severity: 'medium', description: 'Electrician A excludes all low-voltage wiring', bidder: 'Gulf Coast Electrical' },
]

const mockValueEngineering: ValueEngineeringSuggestion[] = [
  { id: '1', description: 'Substitute engineered floor trusses for stick-frame joists on second floor', savings: 3200, impact: 'Faster install, fewer callbacks' },
  { id: '2', description: 'Bundle electrical and low-voltage under single sub to eliminate coordination gaps', savings: 1800, impact: 'Reduces scope gap risk' },
  { id: '3', description: 'Pre-hung door package from single supplier vs. field-hung by framer', savings: 2400, impact: 'Better quality, warranty coverage' },
]

const statusConfig: Record<BidPackageStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-green-100 text-green-700' },
  closing_soon: { label: 'Closing Soon', color: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Under Review', color: 'bg-stone-100 text-stone-700' },
  awarded: { label: 'Awarded', color: 'bg-warm-100 text-warm-700' },
}

// -- Main Component --

export function BiddingEstimatingPreview(): React.ReactElement {
  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-warm-900 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <DollarSign className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Bidding & Estimating Intelligence</h2>
            <p className="text-sm text-warm-400">AI-powered bid analysis, scope gap detection, and value engineering</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white border-b border-warm-200 px-6 py-4">
        <div className="grid grid-cols-5 gap-3">
          {mockStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className={cn('rounded-lg p-3', stat.color.split(' ')[0])}>
                <div className={cn('flex items-center gap-2 text-sm', stat.color.split(' ')[1])}>
                  <Icon className="h-4 w-4" />
                  {stat.label}
                </div>
                <div className={cn('text-2xl font-bold mt-1', stat.valueColor)}>{stat.value}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Bid Packages Table */}
      <div className="bg-white border-b border-warm-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-warm-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-stone-600" />
            Active Bid Packages
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-warm-400" />
              <input
                type="text"
                placeholder="Search packages..."
                className="text-sm pl-8 pr-3 py-1.5 border border-warm-200 rounded-md bg-warm-50 text-warm-700 placeholder:text-warm-400 w-48"
                readOnly
              />
            </div>
            <button className="text-xs bg-stone-700 text-white px-3 py-1.5 rounded-md hover:bg-stone-800 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              New Package
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-warm-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-warm-200">
                <th className="text-left px-4 py-2.5 font-medium text-warm-600">Trade</th>
                <th className="text-center px-4 py-2.5 font-medium text-warm-600">Bidders Invited</th>
                <th className="text-center px-4 py-2.5 font-medium text-warm-600">Bids Received</th>
                <th className="text-center px-4 py-2.5 font-medium text-warm-600">Due Date</th>
                <th className="text-center px-4 py-2.5 font-medium text-warm-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockBidPackages.map((pkg) => {
                const status = statusConfig[pkg.status]
                return (
                  <tr key={pkg.id} className="border-b border-warm-100 last:border-0 hover:bg-warm-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-warm-900">{pkg.trade}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-warm-600">
                        <Users className="h-3.5 w-3.5" />
                        {pkg.biddersInvited}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'font-medium',
                        pkg.bidsReceived === pkg.biddersInvited ? 'text-green-600' : 'text-warm-700'
                      )}>
                        {pkg.bidsReceived}/{pkg.biddersInvited}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-warm-600 flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(pkg.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2.5 py-1 rounded font-medium', status.color)}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bid Leveling View */}
      <div className="bg-white border-b border-warm-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-warm-900 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-stone-600" />
            Bid Leveling -- Framing - Smith Residence
          </h3>
          <span className="text-xs text-warm-500">Budget: $45,000</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {mockBidders.map((bidder) => {
            const vsBudget = ((bidder.baseBid - 45000) / 45000) * 100
            const hasIssues = bidder.exclusions.length > 0 || bidder.scopeGaps.length > 0
            return (
              <div
                key={bidder.name}
                className={cn(
                  'rounded-lg border p-4',
                  bidder.recommended
                    ? 'border-green-300 bg-green-50'
                    : hasIssues
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-warm-200 bg-white'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-warm-900 text-sm">{bidder.name}</h4>
                      {bidder.recommended && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" /> Best Value
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-bold text-warm-900">${bidder.baseBid.toLocaleString()}</div>
                  <div className={cn(
                    'text-xs font-medium mt-0.5',
                    vsBudget < 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {vsBudget < 0 ? '' : '+'}{vsBudget.toFixed(1)}% vs budget
                  </div>
                </div>

                {bidder.exclusions.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-warm-600 mb-1 flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-amber-500" />
                      Exclusions ({bidder.exclusions.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bidder.exclusions.map((exc) => (
                        <span key={exc} className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          {exc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {bidder.scopeGaps.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      AI Scope Gaps ({bidder.scopeGaps.length})
                    </div>
                    {bidder.scopeGaps.map((gap, i) => (
                      <div key={i} className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded mb-1">
                        {gap}
                      </div>
                    ))}
                  </div>
                )}

                {bidder.exclusions.length === 0 && bidder.scopeGaps.length === 0 && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Full scope coverage, no exclusions
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Scope Gap Detection */}
      <div className="bg-white border-b border-warm-200 px-6 py-4">
        <h3 className="font-semibold text-warm-900 flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          AI Scope Gap Detection
        </h3>
        <div className="space-y-2">
          {mockScopeGaps.map((gap) => (
            <div
              key={gap.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                gap.severity === 'high'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-amber-50/50 border-amber-100'
              )}
            >
              <AlertTriangle className={cn(
                'h-4 w-4 mt-0.5 flex-shrink-0',
                gap.severity === 'high' ? 'text-amber-600' : 'text-amber-500'
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-amber-800">{gap.description}</div>
                <div className="text-xs text-amber-600 mt-0.5">
                  Bidder: {gap.bidder}
                  <span className="mx-2 text-amber-300">|</span>
                  Severity: <span className={cn(
                    'font-medium',
                    gap.severity === 'high' ? 'text-amber-700' : 'text-amber-600'
                  )}>{gap.severity === 'high' ? 'High' : 'Medium'}</span>
                </div>
              </div>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0',
                gap.severity === 'high'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-amber-100 text-amber-700'
              )}>
                {gap.severity === 'high' ? 'Action Required' : 'Review'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Value Engineering Suggestions */}
      <div className="bg-white border-b border-warm-200 px-6 py-4">
        <h3 className="font-semibold text-warm-900 flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Value Engineering Suggestions
        </h3>
        <div className="space-y-2">
          {mockValueEngineering.map((suggestion) => (
            <div key={suggestion.id} className="flex items-start gap-3 p-3 bg-warm-50 rounded-lg border border-warm-200">
              <div className="p-1.5 bg-green-100 rounded">
                <TrendingDown className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-warm-900">{suggestion.description}</div>
                <div className="text-xs text-warm-500 mt-0.5">{suggestion.impact}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-green-600">-${suggestion.savings.toLocaleString()}</div>
                <div className="text-[10px] text-warm-400">estimated savings</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-warm-100">
            <span className="text-sm text-warm-600">Total potential savings</span>
            <span className="text-sm font-bold text-green-600">
              -${mockValueEngineering.reduce((sum, s) => sum + s.savings, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200 px-6 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">AI Insights:</span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-amber-700">
            <span>Coastal Framing offers best value at $42,800 -- 4.9% under budget with full scope coverage. QuickFrame is 14.4% cheaper but excludes sheathing and hardware worth ~$5,200.</span>
            <span>23 scope gaps detected across 12 active bids this month. Plumbing trades have the highest gap rate (38%). Consider standardizing scope checklists.</span>
            <span>Value engineering suggestions could save $7,400 across current packages without impacting quality or schedule.</span>
          </div>
        </div>
      </div>

      {/* AI Features Panel */}
      <AIFeaturesPanel
        features={[
          {
            feature: 'Bid Leveling & Comparison',
            insight: 'Side-by-side bid analysis with scope normalization',
          },
          {
            feature: 'Scope Gap Detection',
            insight: 'AI identifies missing scope items across all bids',
          },
          {
            feature: 'Value Engineering',
            insight: 'Material and method substitution recommendations',
          },
          {
            feature: 'Price Anomaly Detection',
            insight: 'Flags suspiciously high or low bids automatically',
          },
          {
            feature: 'Historical Bid Analytics',
            insight: 'Compares bids against historical pricing data',
          },
          {
            feature: 'Vendor Performance Scoring',
            insight: 'Incorporates past performance into bid recommendations',
          },
        ]}
      />
    </div>
  )
}
