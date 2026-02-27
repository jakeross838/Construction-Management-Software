'use client'

import {
  BarChart3,
  FileText,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Calendar,
  Download,
  ChevronRight,
  Activity,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// ── Types ───────────────────────────────────────────────────────────────

interface PortfolioJob {
  id: string
  name: string
  pm: string
  healthScore: number
  status: 'on-track' | 'at-risk' | 'critical'
  budgetPct: number
  schedulePct: number
  qualityScore: number
  lastUpdated: string
}

interface CashFlowMonth {
  month: string
  inflow: number
  outflow: number
  net: number
}

// ── Mock Data ───────────────────────────────────────────────────────────

const portfolioJobs: PortfolioJob[] = [
  {
    id: '1',
    name: 'Smith Residence',
    pm: 'Mike Torres',
    healthScore: 72,
    status: 'at-risk',
    budgetPct: 94,
    schedulePct: 88,
    qualityScore: 96,
    lastUpdated: '2026-02-22',
  },
  {
    id: '2',
    name: 'Johnson Beach House',
    pm: 'Sarah Chen',
    healthScore: 91,
    status: 'on-track',
    budgetPct: 98,
    schedulePct: 100,
    qualityScore: 94,
    lastUpdated: '2026-02-22',
  },
  {
    id: '3',
    name: 'Williams Remodel',
    pm: 'Mike Torres',
    healthScore: 88,
    status: 'on-track',
    budgetPct: 95,
    schedulePct: 92,
    qualityScore: 97,
    lastUpdated: '2026-02-21',
  },
  {
    id: '4',
    name: 'Davis Coastal Home',
    pm: 'Sarah Chen',
    healthScore: 54,
    status: 'critical',
    budgetPct: 78,
    schedulePct: 85,
    qualityScore: 91,
    lastUpdated: '2026-02-22',
  },
]

const cashFlowData: CashFlowMonth[] = [
  { month: 'Feb', inflow: 320000, outflow: 285000, net: 35000 },
  { month: 'Mar', inflow: 410000, outflow: 355000, net: 55000 },
  { month: 'Apr', inflow: 380000, outflow: 340000, net: 40000 },
  { month: 'May', inflow: 450000, outflow: 290000, net: 160000 },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K'
  return '$' + value.toFixed(0)
}

function healthColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function healthBg(score: number): string {
  if (score >= 80) return 'bg-green-100'
  if (score >= 60) return 'bg-amber-100'
  return 'bg-red-100'
}

function statusBadge(status: 'on-track' | 'at-risk' | 'critical'): { bg: string; text: string; label: string } {
  switch (status) {
    case 'on-track':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'On Track' }
    case 'at-risk':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'At Risk' }
    case 'critical':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' }
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function SmartReportsPreview(): React.ReactElement {
  const maxCashFlow = Math.max(...cashFlowData.map(d => Math.max(d.inflow, d.outflow)))

  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-800 px-6 py-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-white/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Smart Reports & Intelligence</h2>
            <p className="text-sm text-stone-300">
              AI-generated narratives, portfolio health, cash flow forecasting
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <FileText className="h-4 w-4" />
              Reports Generated
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">42</div>
            <div className="text-xs text-warm-500 mt-0.5">This month</div>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <Clock className="h-4 w-4" />
              Scheduled
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">8</div>
            <div className="text-xs text-warm-500 mt-0.5">Active schedules</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Activity className="h-4 w-4" />
              Portfolio Health
            </div>
            <div className="text-xl font-bold text-green-700 mt-1">87%</div>
            <div className="text-xs text-warm-500 mt-0.5">Weighted average</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <DollarSign className="h-4 w-4" />
              Cash Position
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">$284K</div>
            <div className="text-xs text-green-500 mt-0.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12% vs last month
            </div>
          </div>
        </div>
      </div>

      {/* Owner's Weekly Report - AI Narrative */}
      <div className="p-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-medium text-warm-900 text-sm">Owner&apos;s Weekly Report</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                AI Generated
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-warm-400">Feb 22, 2026</span>
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-warm-600 border border-warm-200 rounded hover:bg-warm-50">
                <Download className="h-3 w-3" />
                PDF
              </button>
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-warm-600 border border-warm-200 rounded hover:bg-warm-50">
                <Eye className="h-3 w-3" />
                Preview
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-warm-700 leading-relaxed">
                <span className="font-medium text-warm-900">Smith Residence</span> is 65% complete,
                on budget, but 3 days behind schedule due to weather delays last week. Framing inspection
                passed on Thursday; electrical rough-in begins Monday. The client approved Change Order #4
                for the upgraded kitchen hood ($2,800).
              </p>
              <p className="text-sm text-warm-700 leading-relaxed mt-2">
                <span className="font-medium text-warm-900">Johnson Beach House</span> is tracking ahead
                of schedule by 2 days. Foundation pour completed Wednesday - compressive strength tests
                pending. No budget concerns at 28% completion.
              </p>
              <p className="text-sm text-warm-700 leading-relaxed mt-2">
                <span className="font-medium text-warm-900">Davis Coastal Home</span> requires attention -
                foundation cost overrun of $42K due to unexpected soil conditions. Recommend scheduling
                a meeting with the client to discuss options.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-warm-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Week of Feb 17-22, 2026
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Auto-generated from daily logs, budgets, and schedules
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Health Grid */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <h3 className="font-medium text-warm-900 text-sm">Portfolio Health Scores</h3>
            <button className="text-xs text-stone-600 hover:text-stone-700 font-medium flex items-center gap-1">
              View Details <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-0 divide-x divide-warm-200">
            {portfolioJobs.map((job) => {
              const badge = statusBadge(job.status)
              return (
                <div key={job.id} className="p-4 hover:bg-warm-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-warm-900 truncate">{job.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('text-2xl font-bold', healthColor(job.healthScore))}>
                      {job.healthScore}
                    </div>
                    <div className={cn('text-xs px-1.5 py-0.5 rounded font-medium', badge.bg, badge.text)}>
                      {badge.label}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warm-500">Budget</span>
                      <span className={cn('font-medium', job.budgetPct >= 90 ? 'text-green-600' : 'text-amber-600')}>
                        {job.budgetPct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warm-500">Schedule</span>
                      <span className={cn('font-medium', job.schedulePct >= 90 ? 'text-green-600' : 'text-amber-600')}>
                        {job.schedulePct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warm-500">Quality</span>
                      <span className="font-medium text-green-600">{job.qualityScore}%</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-warm-400">PM: {job.pm}</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-end gap-4 px-4 py-2 bg-warm-50 border-t border-warm-200 text-xs text-warm-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded" /> Healthy (80+)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 rounded" /> At Risk (60-79)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded" /> Critical (&lt;60)</span>
          </div>
        </div>
      </div>

      {/* Cash Flow Forecast Chart */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-stone-500" />
              <h3 className="font-medium text-warm-900 text-sm">Cash Flow Forecast</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-warm-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-green-400 rounded-sm" /> Inflow
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-red-300 rounded-sm" /> Outflow
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-stone-600 rounded-sm" /> Net
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-6 justify-around h-40">
              {cashFlowData.map((month) => {
                const inflowHeight = (month.inflow / maxCashFlow) * 100
                const outflowHeight = (month.outflow / maxCashFlow) * 100
                return (
                  <div key={month.month} className="flex flex-col items-center gap-1 flex-1">
                    <div className="flex items-end gap-1 h-28">
                      <div
                        className="w-6 bg-green-400 rounded-t"
                        style={{ height: `${inflowHeight}%` }}
                        title={`Inflow: ${formatCurrency(month.inflow)}`}
                      />
                      <div
                        className="w-6 bg-red-300 rounded-t"
                        style={{ height: `${outflowHeight}%` }}
                        title={`Outflow: ${formatCurrency(month.outflow)}`}
                      />
                    </div>
                    <div className="text-xs font-medium text-warm-700 mt-1">{month.month}</div>
                    <div className={cn(
                      'text-xs font-semibold',
                      month.net >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {month.net >= 0 ? '+' : ''}{formatCurrency(month.net)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-warm-500 border-t border-warm-100 pt-3">
              <span>4-month projected net: <span className="font-semibold text-green-600">+{formatCurrency(290000)}</span></span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                AI-forecasted based on draw schedules, AP aging, and historical patterns
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-warm-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">Report Intelligence:</span>
          </div>
          <p className="text-sm text-amber-700">
            Davis Coastal Home health score dropped 8 points this week - foundation overrun is primary driver.
            Cash position improves significantly in May when Johnson Beach House Draw #5 ($180K) is expected.
            Consider generating a client-facing update for Smith Residence to address the 3-day schedule delay
            proactively.
          </p>
        </div>
      </div>

      {/* AI Features Panel */}
      <div className="px-4 py-4 bg-white border-t border-warm-200">
        <AIFeaturesPanel
          title="AI-Powered Reporting Features"
          columns={2}
          features={[
            {
              feature: 'Narrative Generation',
              trigger: 'Weekly',
              insight: 'Writes owner reports from project data',
              detail: 'Automatically generates plain-English project summaries from daily logs, budget data, schedule status, and change orders. Currently producing weekly owner reports for 4 active jobs.',
              severity: 'success',
              confidence: 91,
            },
            {
              feature: 'Portfolio Health Scoring',
              trigger: 'Real-time',
              insight: 'Composite score from budget, schedule, quality',
              detail: 'Calculates a weighted health score (0-100) for each project based on budget adherence (40%), schedule performance (35%), and quality metrics (25%). Alerts when scores drop below thresholds.',
              severity: 'info',
              confidence: 94,
            },
            {
              feature: 'Cash Flow Forecasting',
              trigger: 'Daily',
              insight: 'Predicts cash position 90 days out',
              detail: 'Models expected cash inflows from draw requests and receivables against committed outflows from purchase orders, payroll, and vendor payments. Currently forecasting a healthy +$290K net over 4 months.',
              severity: 'success',
              confidence: 88,
            },
            {
              feature: 'Anomaly Detection',
              trigger: 'On change',
              insight: 'Flags unusual cost or schedule patterns',
              detail: 'Monitors all project metrics for statistical anomalies. Currently flagging Davis Coastal Home foundation costs as 2.3 standard deviations above expected range for coastal builds.',
              severity: 'warning',
              confidence: 86,
            },
          ]}
        />
      </div>
    </div>
  )
}
