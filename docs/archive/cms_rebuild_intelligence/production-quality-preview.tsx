'use client'

import {
  HardHat,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  BarChart3,
  Users,
  AlertTriangle,
  Target,
  Activity,
  Zap,
  ChevronRight,
  Building2,
  Calendar,
  User,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// -- Types -------------------------------------------------------------------

interface StatCard {
  label: string
  value: string
  icon: React.ElementType
  color: 'stone' | 'amber' | 'green' | 'warm'
  change?: string
  trend?: 'up' | 'down'
}

interface GanttTask {
  name: string
  status: 'complete' | 'in-progress' | 'upcoming'
  progress: number
  startCol: number
  spanCols: number
  isCriticalPath: boolean
}

interface ChecklistItem {
  label: string
  checked: boolean
}

interface CrewAssignment {
  crew: string
  trade: string
  jobs: Record<string, string>
}

interface AIPrediction {
  type: 'warning' | 'alert' | 'optimization'
  title: string
  message: string
}

// -- Mock Data ---------------------------------------------------------------

const stats: StatCard[] = [
  { label: 'Active Jobs', value: '8', icon: Building2, color: 'stone' },
  { label: 'Tasks Today', value: '24', icon: Calendar, color: 'warm' },
  { label: 'On Schedule', value: '75%', icon: Target, color: 'amber', change: '-5%', trend: 'down' },
  { label: 'Quality Score', value: '94%', icon: CheckCircle2, color: 'green', change: '+2%', trend: 'up' },
  { label: 'Crews Active', value: '12', icon: Users, color: 'stone', change: '+1', trend: 'up' },
]

const ganttTasks: GanttTask[] = [
  { name: 'Foundation', status: 'complete', progress: 100, startCol: 1, spanCols: 3, isCriticalPath: true },
  { name: 'Framing', status: 'in-progress', progress: 60, startCol: 3, spanCols: 4, isCriticalPath: true },
  { name: 'Roofing', status: 'upcoming', progress: 0, startCol: 6, spanCols: 2, isCriticalPath: false },
  { name: 'Rough MEP', status: 'upcoming', progress: 0, startCol: 7, spanCols: 3, isCriticalPath: true },
  { name: 'Drywall', status: 'upcoming', progress: 0, startCol: 9, spanCols: 3, isCriticalPath: false },
]

const ganttWeeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12']

const checklistItems: ChecklistItem[] = [
  { label: 'Electrical covers on all boxes', checked: true },
  { label: 'Plumbing pressure test passed', checked: true },
  { label: 'HVAC duct sealing verified', checked: false },
  { label: 'Fire blocking installed', checked: false },
  { label: 'Framing corrections complete', checked: true },
  { label: 'Window flashing inspected', checked: false },
]

const crewAssignments: CrewAssignment[] = [
  {
    crew: "Mike's Crew",
    trade: 'Framing',
    jobs: { 'Smith Residence': 'Framing 2nd Floor', 'Johnson Beach': '--', 'Harbor View': '--' },
  },
  {
    crew: "Tom's Crew",
    trade: 'Electrical',
    jobs: { 'Smith Residence': 'Rough-In Kitchen', 'Johnson Beach': 'Panel Install', 'Harbor View': '--' },
  },
  {
    crew: "Carlos's Crew",
    trade: 'Plumbing',
    jobs: { 'Smith Residence': '--', 'Johnson Beach': 'Rough-In Baths', 'Harbor View': 'Top-Out' },
  },
  {
    crew: "Sarah's Crew",
    trade: 'HVAC',
    jobs: { 'Smith Residence': 'Duct Rough-In', 'Johnson Beach': '--', 'Harbor View': 'Startup & Balance' },
  },
]

const aiPredictions: AIPrediction[] = [
  {
    type: 'warning',
    title: 'Schedule Delay',
    message: 'Framing will finish 2 days late based on current pace. Critical path impact: Rough MEP start pushed to Feb 28.',
  },
  {
    type: 'alert',
    title: 'Cost Alert',
    message: 'Electrical trending $2,400 over budget at Smith Residence. 68% of budget consumed at 55% completion.',
  },
  {
    type: 'optimization',
    title: 'Crew Optimization',
    message: "Assign Mike's crew to critical path framing at Harbor View. Current utilization: 65%. Moving them increases on-time probability by 18%.",
  },
]

// -- Sub-components ----------------------------------------------------------

function StatCardComponent({ stat }: { stat: StatCard }) {
  const Icon = stat.icon
  const colorMap = {
    stone: { bg: 'bg-stone-50', iconBg: 'bg-stone-100', iconText: 'text-stone-600' },
    amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    green: { bg: 'bg-green-50', iconBg: 'bg-green-100', iconText: 'text-green-600' },
    warm: { bg: 'bg-warm-50', iconBg: 'bg-warm-100', iconText: 'text-warm-600' },
  }
  const colors = colorMap[stat.color]

  return (
    <div className={cn('rounded-lg p-3', colors.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colors.iconBg)}>
          <Icon className={cn('h-5 w-5', colors.iconText)} />
        </div>
        {stat.change && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            stat.trend === 'up' ? 'text-green-600' : 'text-amber-600'
          )}>
            {stat.trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {stat.trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {stat.change}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-warm-900">{stat.value}</div>
      <div className="text-sm text-warm-500">{stat.label}</div>
    </div>
  )
}

function GanttBar({ task }: { task: GanttTask }) {
  const barColor =
    task.status === 'complete' ? 'bg-green-500' :
    task.status === 'in-progress' ? 'bg-stone-500' :
    'bg-warm-300'

  const progressColor =
    task.status === 'in-progress' ? 'bg-stone-400' : ''

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Task name */}
      <div className="w-28 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-warm-900">{task.name}</span>
          {task.isCriticalPath && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Critical Path" />
          )}
        </div>
        {task.status === 'in-progress' && (
          <span className="text-xs text-stone-600">{task.progress}%</span>
        )}
        {task.status === 'complete' && (
          <span className="text-xs text-green-600">Done</span>
        )}
      </div>

      {/* Gantt grid */}
      <div className="flex-1 relative">
        <div className="grid grid-cols-12 gap-px h-7">
          {ganttWeeks.map((_, i) => (
            <div key={i} className="bg-warm-100 rounded-sm" />
          ))}
        </div>
        {/* Bar overlay */}
        <div
          className="absolute top-0 h-7 rounded flex items-center overflow-hidden"
          style={{
            left: `${((task.startCol - 1) / 12) * 100}%`,
            width: `${(task.spanCols / 12) * 100}%`,
          }}
        >
          <div className={cn('h-full w-full rounded', barColor, 'relative')}>
            {task.status === 'in-progress' && (
              <div
                className={cn('absolute inset-y-0 left-0 rounded-l', progressColor)}
                style={{ width: `${task.progress}%`, opacity: 0.5 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PredictionCard({ prediction }: { prediction: AIPrediction }) {
  const config = {
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock, iconColor: 'text-amber-600', titleColor: 'text-amber-800' },
    alert: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, iconColor: 'text-red-600', titleColor: 'text-red-800' },
    optimization: { bg: 'bg-stone-50', border: 'border-stone-200', icon: Zap, iconColor: 'text-stone-600', titleColor: 'text-stone-800' },
  }
  const c = config[prediction.type]
  const Icon = c.icon

  return (
    <div className={cn('rounded-lg border p-3', c.bg, c.border)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', c.iconColor)} />
        <div>
          <h5 className={cn('text-sm font-medium', c.titleColor)}>{prediction.title}</h5>
          <p className="text-xs text-warm-700 mt-1">{prediction.message}</p>
        </div>
      </div>
    </div>
  )
}

// -- Main Component ----------------------------------------------------------

export function ProductionQualityPreview(): React.ReactElement {
  const completedCount = checklistItems.filter((item) => item.checked).length
  const totalCount = checklistItems.length
  const completionPercent = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-warm-900 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warm-800">
              <HardHat className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Production & Quality Control</h3>
              <p className="text-sm text-warm-400">
                Gantt charts, quality checklists, crew management, and AI-powered production intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-warm-300 border border-warm-700 rounded-lg hover:bg-warm-800">
              <BarChart3 className="h-4 w-4" />
              Reports
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">
              <Activity className="h-4 w-4" />
              Live Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-3">
          {stats.map((stat, i) => (
            <StatCardComponent key={i} stat={stat} />
          ))}
        </div>

        {/* Mini Gantt Chart */}
        <div className="bg-white rounded-lg border border-warm-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-warm-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-stone-600" />
              Production Schedule - Smith Residence
            </h4>
            <div className="flex items-center gap-3 text-xs text-warm-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Complete
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-500" />
                In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warm-300" />
                Upcoming
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Critical Path
              </span>
            </div>
          </div>

          {/* Week headers */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-28 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-12 gap-px">
              {ganttWeeks.map((w) => (
                <div key={w} className="text-center text-[10px] text-warm-400 font-medium">
                  {w}
                </div>
              ))}
            </div>
          </div>

          {/* Today marker description */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-28 flex-shrink-0" />
            <div className="flex-1 relative">
              <div
                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                style={{ left: `${(4 / 12) * 100}%` }}
              />
              <div
                className="absolute -top-0.5 text-[9px] text-red-500 font-medium"
                style={{ left: `${(4 / 12) * 100}%`, transform: 'translateX(-50%)' }}
              >
                Today
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="divide-y divide-warm-100">
            {ganttTasks.map((task) => (
              <GanttBar key={task.name} task={task} />
            ))}
          </div>

          {/* Critical path summary */}
          <div className="mt-3 pt-3 border-t border-warm-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-warm-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="font-medium text-warm-700">Critical Path:</span>
              Foundation &rarr; Framing &rarr; Rough MEP
            </div>
            <button className="text-xs text-stone-600 hover:text-stone-700 flex items-center gap-1">
              View Full Schedule <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Quality Checklist */}
          <div className="bg-white rounded-lg border border-warm-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-warm-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Pre-Drywall Walkthrough
              </h4>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded font-medium',
                completionPercent >= 80 ? 'bg-green-100 text-green-700' :
                completionPercent >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-warm-100 text-warm-700'
              )}>
                {completedCount}/{totalCount} items
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-warm-500">Smith Residence - Lot 47</span>
                <span className="font-medium text-warm-700">{completionPercent}%</span>
              </div>
              <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    completionPercent >= 80 ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              {checklistItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                    item.checked ? 'bg-green-50' : 'bg-warm-50'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    item.checked ? 'bg-green-500 border-green-500' : 'border-warm-300 bg-white'
                  )}>
                    {item.checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <span className={cn(
                    item.checked ? 'text-warm-600 line-through' : 'text-warm-900'
                  )}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-warm-100 flex items-center justify-between text-xs text-warm-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Inspector: Mike Thompson
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: Feb 14, 2026
              </span>
            </div>
          </div>

          {/* Daily Crew Board */}
          <div className="bg-white rounded-lg border border-warm-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-warm-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-600" />
                Daily Crew Board
              </h4>
              <span className="text-xs text-warm-500">Feb 13, 2026</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-warm-200">
              <table className="w-full">
                <thead className="bg-warm-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-warm-500">Crew / Trade</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-warm-500">Smith Residence</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-warm-500">Johnson Beach</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-warm-500">Harbor View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100">
                  {crewAssignments.map((crew) => (
                    <tr key={crew.crew} className="hover:bg-warm-50">
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-warm-900">{crew.crew}</div>
                        <div className="text-xs text-warm-500">{crew.trade}</div>
                      </td>
                      {['Smith Residence', 'Johnson Beach', 'Harbor View'].map((job) => (
                        <td key={job} className="px-3 py-2 text-center">
                          {crew.jobs[job] === '--' ? (
                            <span className="text-xs text-warm-300">--</span>
                          ) : (
                            <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                              {crew.jobs[job]}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-warm-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-warm-500">
                <MapPin className="h-3 w-3" />
                <span>3 active job sites</span>
                <span className="text-warm-300">|</span>
                <span>4 crews deployed</span>
              </div>
              <button className="text-xs text-stone-600 hover:text-stone-700 flex items-center gap-1">
                Full Board <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* AI Production Intelligence */}
        <div className="bg-white rounded-lg border border-warm-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-warm-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              AI Production Intelligence
            </h4>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
              {aiPredictions.length} active predictions
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {aiPredictions.map((prediction, i) => (
              <PredictionCard key={i} prediction={prediction} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-gradient-to-r from-amber-50 to-stone-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">Production Intelligence:</span>
          </div>
          <div className="text-sm text-amber-700 space-y-1">
            <p>
              Smith Residence framing is 2 days behind critical path. Weather forecast shows rain Thursday -
              recommend prioritizing exterior framing completion by Wednesday to avoid further delays.
            </p>
            <p>
              Quality score trending up across all active jobs (+2% this week). Pre-drywall checklists
              catching 94% of issues before drywall install, reducing rework costs by an estimated $3,200/job.
            </p>
          </div>
        </div>
      </div>

      {/* AI Features Panel */}
      <div className="border-t border-warm-200 px-4 py-4 bg-white">
        <AIFeaturesPanel
          title="Production & Quality AI Features"
          columns={2}
          features={[
            {
              feature: 'Schedule Delay Prediction',
              trigger: 'Real-time',
              insight: 'Analyzes crew velocity, weather forecasts, and material deliveries to predict schedule slippage 3-5 days in advance.',
              severity: 'warning',
              confidence: 85,
            },
            {
              feature: 'Cost Overrun Detection',
              trigger: 'Daily',
              insight: 'Compares actual spend vs. budget burn rate by trade. Flags cost codes trending over budget before they exceed thresholds.',
              severity: 'critical',
              confidence: 88,
            },
            {
              feature: 'Crew Optimization Engine',
              trigger: 'On-change',
              insight: 'Recommends crew assignments based on skill match, proximity, critical path priority, and historical productivity data.',
              severity: 'info',
              confidence: 82,
            },
            {
              feature: 'Quality Pattern Analysis',
              trigger: 'Real-time',
              insight: 'Identifies recurring quality issues by trade, vendor, and building phase. Recommends targeted pre-inspection checklists.',
              severity: 'success',
              confidence: 91,
            },
            {
              feature: 'Weather Impact Forecasting',
              trigger: 'Daily',
              insight: 'Integrates 10-day weather forecast with schedule to auto-flag at-risk exterior tasks and suggest resequencing options.',
              severity: 'info',
              confidence: 94,
            },
          ]}
        />
      </div>
    </div>
  )
}
