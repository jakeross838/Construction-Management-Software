'use client'

import {
  Brain,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Sun,
  CloudRain,
  Calendar,
  DollarSign,
  Users,
  Zap,
  ArrowRight,
  Shield,
  Activity,
  ChevronRight,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// ── Types ───────────────────────────────────────────────────────────────

interface ProjectHealth {
  id: string
  name: string
  pm: string
  score: number
  trend: 'up' | 'down' | 'stable'
  trendDelta: number
  budgetStatus: 'on-track' | 'at-risk' | 'over'
  scheduleStatus: 'on-track' | 'at-risk' | 'behind'
  topRisk?: string
}

interface Risk {
  id: string
  title: string
  project: string
  probability: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  category: string
  recommendation: string
}

// ── Mock Data ───────────────────────────────────────────────────────────

const morningBriefing = {
  date: 'Sunday, Feb 22, 2026',
  generatedAt: '6:45 AM',
  items: [
    { icon: Sun, text: 'Clear skies today - good conditions for exterior work on Smith Residence and Johnson Beach House.', type: 'info' as const },
    { icon: AlertTriangle, text: 'Davis Coastal Home foundation cost overrun now at $42K. Meeting with structural engineer recommended this week.', type: 'warning' as const },
    { icon: DollarSign, text: 'Draw #3 for Johnson Beach House ($60K) approved by lender yesterday - expect funds by Wednesday.', type: 'success' as const },
    { icon: Calendar, text: '3 inspections scheduled this week: Smith framing (Mon), Johnson foundation (Wed), Williams final (Fri).', type: 'info' as const },
    { icon: Users, text: 'ABC Framing crew confirmed for Smith Residence Monday. Electrical sub starting Johnson rough-in Tuesday.', type: 'info' as const },
  ],
}

const projectHealthScores: ProjectHealth[] = [
  {
    id: '1',
    name: 'Smith Residence',
    pm: 'Mike Torres',
    score: 72,
    trend: 'down',
    trendDelta: -4,
    budgetStatus: 'on-track',
    scheduleStatus: 'behind',
    topRisk: 'Framing labor 40% over budget',
  },
  {
    id: '2',
    name: 'Johnson Beach House',
    pm: 'Sarah Chen',
    score: 91,
    trend: 'up',
    trendDelta: 3,
    budgetStatus: 'on-track',
    scheduleStatus: 'on-track',
  },
  {
    id: '3',
    name: 'Williams Remodel',
    pm: 'Mike Torres',
    score: 88,
    trend: 'stable',
    trendDelta: 0,
    budgetStatus: 'on-track',
    scheduleStatus: 'on-track',
  },
  {
    id: '4',
    name: 'Davis Coastal Home',
    pm: 'Sarah Chen',
    score: 54,
    trend: 'down',
    trendDelta: -8,
    budgetStatus: 'over',
    scheduleStatus: 'behind',
    topRisk: 'Foundation cost overrun - soil conditions',
  },
]

const risks: Risk[] = [
  {
    id: '1',
    title: 'Foundation cost escalation',
    project: 'Davis Coastal Home',
    probability: 'high',
    impact: 'high',
    category: 'Budget',
    recommendation: 'Schedule client meeting to discuss change order for additional soil remediation.',
  },
  {
    id: '2',
    title: 'Framing labor overrun',
    project: 'Smith Residence',
    probability: 'medium',
    impact: 'medium',
    category: 'Budget',
    recommendation: 'Request detailed breakdown from ABC Framing for tray ceiling scope. Consider change order.',
  },
  {
    id: '3',
    title: 'Rain forecast mid-week',
    project: 'Johnson Beach House',
    probability: 'medium',
    impact: 'low',
    category: 'Weather',
    recommendation: 'Move exterior work to Monday-Tuesday. Foundation pour already complete.',
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function probImpactBadge(level: 'high' | 'medium' | 'low'): { bg: string; text: string } {
  switch (level) {
    case 'high':
      return { bg: 'bg-red-100', text: 'text-red-700' }
    case 'medium':
      return { bg: 'bg-amber-100', text: 'text-amber-700' }
    case 'low':
      return { bg: 'bg-green-100', text: 'text-green-700' }
  }
}

function budgetBadge(status: 'on-track' | 'at-risk' | 'over'): { bg: string; text: string; label: string } {
  switch (status) {
    case 'on-track':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'On Budget' }
    case 'at-risk':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'At Risk' }
    case 'over':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Over Budget' }
  }
}

function scheduleBadge(status: 'on-track' | 'at-risk' | 'behind'): { bg: string; text: string; label: string } {
  switch (status) {
    case 'on-track':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'On Schedule' }
    case 'at-risk':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'At Risk' }
    case 'behind':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Behind' }
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function AIHubPreview(): React.ReactElement {
  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-800 px-6 py-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-white/10 rounded-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Command Center</h2>
            <p className="text-sm text-stone-300">
              Morning briefings, project health scores, scenario engine, and cross-cutting intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <Target className="h-4 w-4" />
              AI Accuracy
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">94.2%</div>
            <div className="text-xs text-green-500 mt-0.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +1.8% this month
            </div>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <Zap className="h-4 w-4" />
              Predictions Today
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">12</div>
            <div className="text-xs text-warm-500 mt-0.5">Across all projects</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">5</div>
            <div className="text-xs text-warm-500 mt-0.5">2 high priority</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <Brain className="h-4 w-4" />
              Learning Events
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">847</div>
            <div className="text-xs text-warm-500 mt-0.5">Patterns learned</div>
          </div>
        </div>
      </div>

      {/* Morning Briefing */}
      <div className="p-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200 bg-gradient-to-r from-stone-50 to-warm-50">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <h3 className="font-medium text-warm-900 text-sm">Morning Briefing</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                AI Generated
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-warm-400">
              <Clock className="h-3 w-3" />
              {morningBriefing.date} at {morningBriefing.generatedAt}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {morningBriefing.items.map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className={cn(
                  'flex items-start gap-3 p-2.5 rounded-lg',
                  item.type === 'warning' && 'bg-amber-50',
                  item.type === 'success' && 'bg-green-50',
                  item.type === 'info' && 'bg-stone-50',
                )}>
                  <Icon className={cn(
                    'h-4 w-4 mt-0.5 flex-shrink-0',
                    item.type === 'warning' && 'text-amber-500',
                    item.type === 'success' && 'text-green-500',
                    item.type === 'info' && 'text-stone-500',
                  )} />
                  <span className={cn(
                    'text-sm',
                    item.type === 'warning' && 'text-amber-700',
                    item.type === 'success' && 'text-green-700',
                    item.type === 'info' && 'text-stone-700',
                  )}>
                    {item.text}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Project Health Scores */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-stone-500" />
              <h3 className="font-medium text-warm-900 text-sm">Project Health Scores</h3>
            </div>
            <button className="text-xs text-stone-600 hover:text-stone-700 font-medium flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-warm-100">
            {projectHealthScores.map((project) => {
              const bBadge = budgetBadge(project.budgetStatus)
              const sBadge = scheduleBadge(project.scheduleStatus)
              return (
                <div key={project.id} className="px-4 py-3 hover:bg-warm-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Score Circle */}
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="#e7e5e4" strokeWidth="4" />
                          <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray={`${(project.score / 100) * 125.6} 125.6`}
                            strokeLinecap="round"
                            className={scoreColor(project.score)}
                          />
                        </svg>
                        <div className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold', scoreColor(project.score))}>
                          {project.score}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-warm-900 text-sm">{project.name}</span>
                          <div className="flex items-center gap-1">
                            {project.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                            {project.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                            {project.trend === 'stable' && <ArrowRight className="h-3 w-3 text-warm-400" />}
                            <span className={cn(
                              'text-xs font-medium',
                              project.trendDelta > 0 && 'text-green-600',
                              project.trendDelta < 0 && 'text-red-600',
                              project.trendDelta === 0 && 'text-warm-400',
                            )}>
                              {project.trendDelta > 0 ? '+' : ''}{project.trendDelta}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-warm-500">PM: {project.pm}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', bBadge.bg, bBadge.text)}>
                        {bBadge.label}
                      </span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', sBadge.bg, sBadge.text)}>
                        {sBadge.label}
                      </span>
                    </div>
                  </div>
                  {project.topRisk && (
                    <div className="ml-16 mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {project.topRisk}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* What-If Scenario Engine */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-stone-500" />
              <h3 className="font-medium text-warm-900 text-sm">&quot;What If&quot; Scenario Engine</h3>
            </div>
            <button className="text-xs text-stone-600 hover:text-stone-700 font-medium flex items-center gap-1">
              New Scenario <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4">
            <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-stone-200 rounded-lg">
                  <Brain className="h-4 w-4 text-stone-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-warm-700 font-medium mb-2">
                    &quot;What if Johnson upgrades to Viking appliances?&quot;
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-warm-200">
                      <div className="text-xs text-warm-500 mb-1">Budget Impact</div>
                      <div className="text-sm font-bold text-amber-600 flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        +$8,200
                      </div>
                      <div className="text-xs text-warm-400 mt-0.5">4.6% of contract</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-warm-200">
                      <div className="text-xs text-warm-500 mb-1">Schedule Impact</div>
                      <div className="text-sm font-bold text-amber-600 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        +3 days
                      </div>
                      <div className="text-xs text-warm-400 mt-0.5">Extended lead time</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-warm-200">
                      <div className="text-xs text-warm-500 mb-1">Margin Effect</div>
                      <div className="text-sm font-bold text-green-600 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +0.4%
                      </div>
                      <div className="text-xs text-warm-400 mt-0.5">If markup applied</div>
                    </div>
                  </div>
                  <p className="text-xs text-warm-500 mt-3">
                    <Sparkles className="h-3 w-3 text-amber-500 inline mr-1" />
                    Recommendation: Accept the upgrade with 15% markup. Viking has 6-week lead time -
                    order by March 1 to avoid schedule slip. Similar upgrades on past projects averaged 18% markup.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Register */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-warm-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-stone-500" />
              <h3 className="font-medium text-warm-900 text-sm">AI Risk Register</h3>
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                {risks.length} Active
              </span>
            </div>
          </div>
          <div className="divide-y divide-warm-100">
            {risks.map((risk) => {
              const probBadge = probImpactBadge(risk.probability)
              const impactBadgeStyle = probImpactBadge(risk.impact)
              return (
                <div key={risk.id} className="px-4 py-3 hover:bg-warm-50">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-warm-900 text-sm">{risk.title}</span>
                        <span className="text-xs text-warm-400 bg-warm-100 px-1.5 py-0.5 rounded">
                          {risk.category}
                        </span>
                      </div>
                      <span className="text-xs text-warm-500">{risk.project}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', probBadge.bg, probBadge.text)}>
                          P: {risk.probability}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', impactBadgeStyle.bg, impactBadgeStyle.text)}>
                          I: {risk.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-stone-600 mt-1">
                    <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    {risk.recommendation}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-warm-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">AI Intelligence:</span>
          </div>
          <p className="text-sm text-amber-700">
            Model accuracy improved 1.8% this month from 847 new learning events. Cost predictions for
            coastal foundations have been recalibrated based on Davis project data. Pattern detected:
            projects using ABC Framing average 3 days longer on framing phase but 8% fewer punch items.
            Next week&apos;s weather outlook is favorable for all 4 active projects.
          </p>
        </div>
      </div>

      {/* AI Features Panel */}
      <div className="px-4 py-4 bg-white border-t border-warm-200">
        <AIFeaturesPanel
          title="AI Command Center Features"
          columns={2}
          features={[
            {
              feature: 'Morning Briefings',
              trigger: 'Daily 6:45 AM',
              insight: 'Personalized daily project summary',
              detail: 'Generates a comprehensive morning briefing by analyzing overnight changes, weather forecasts, scheduled activities, financial updates, and risk indicators across all active projects.',
              severity: 'success',
              confidence: 93,
            },
            {
              feature: 'Health Score Engine',
              trigger: 'Real-time',
              insight: 'Composite project health 0-100',
              detail: 'Calculates health scores using budget adherence (40%), schedule performance (35%), and quality/safety metrics (25%). Trends are tracked over time with automatic alerts on score drops.',
              severity: 'info',
              confidence: 94,
            },
            {
              feature: 'Scenario Modeling',
              trigger: 'On demand',
              insight: 'What-if analysis for decisions',
              detail: 'Models the budget, schedule, and margin impact of proposed changes using historical project data. Provides confidence-weighted recommendations based on outcomes from similar past decisions.',
              severity: 'info',
              confidence: 87,
            },
            {
              feature: 'Risk Prediction',
              trigger: 'Continuous',
              insight: 'Identifies emerging risks early',
              detail: 'Monitors project data streams for early warning signals. Currently tracking 5 active risks across the portfolio. Predicted the Davis foundation issue 2 weeks before it became critical.',
              severity: 'warning',
              confidence: 89,
            },
            {
              feature: 'Cross-Project Learning',
              trigger: 'On change',
              insight: 'Learns from all projects continuously',
              detail: 'Every completed task, cost variance, and vendor interaction becomes a learning event. The model improves its predictions over time. 847 learning events processed this month.',
              severity: 'success',
              confidence: 91,
            },
            {
              feature: 'Vendor Intelligence',
              trigger: 'Weekly',
              insight: 'Correlates vendor performance patterns',
              detail: 'Identifies patterns across vendor performance data - quality scores, schedule adherence, pricing trends. Detects that ABC Framing takes longer but produces fewer defects.',
              severity: 'info',
              confidence: 85,
            },
          ]}
        />
      </div>
    </div>
  )
}
