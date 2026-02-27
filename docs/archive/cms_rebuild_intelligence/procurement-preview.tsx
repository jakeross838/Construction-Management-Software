'use client'

import {
  Package,
  Truck,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Clock,
  CalendarDays,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// -- Types -------------------------------------------------------------------

interface DeliverySlot {
  id: string
  time: string
  jobName: string
  material: string
  vendor: string
  status: 'confirmed' | 'pending' | 'in-transit'
}

interface PurchaseOrderRow {
  id: string
  poNumber: string
  vendor: string
  job: string
  amount: number
  status: 'Sent' | 'Received' | 'Partial'
  eta: string
}

interface LeadTimeItem {
  id: string
  name: string
  weeksRemaining: number
  severity: 'green' | 'amber' | 'red'
  job: string
}

// -- Mock Data ---------------------------------------------------------------

const mockWeekDays = ['Mon 2/24', 'Tue 2/25', 'Wed 2/26', 'Thu 2/27', 'Fri 2/28']

const mockDeliveryCalendar: Record<string, DeliverySlot[]> = {
  'Mon 2/24': [
    { id: '1', time: '8:00 AM', jobName: 'Smith Residence', material: 'Framing Lumber', vendor: 'ABC Lumber', status: 'confirmed' },
  ],
  'Tue 2/25': [
    { id: '2', time: '9:00 AM', jobName: 'Johnson Beach House', material: 'Impact Windows (24)', vendor: 'PGT Industries', status: 'in-transit' },
  ],
  'Wed 2/26': [
    { id: '3', time: '7:30 AM', jobName: 'Harbor View Custom', material: 'Roofing Metal Panels', vendor: 'Coastal Roofing Supply', status: 'pending' },
    { id: '4', time: '1:00 PM', jobName: 'Smith Residence', material: 'Plumbing Fixtures', vendor: 'Jones Plumbing Supply', status: 'confirmed' },
  ],
  'Thu 2/27': [],
  'Fri 2/28': [
    { id: '5', time: '10:00 AM', jobName: 'Miller Addition', material: 'Electrical Panels', vendor: 'Smith Electric Supply', status: 'confirmed' },
  ],
}

const mockPurchaseOrders: PurchaseOrderRow[] = [
  { id: '1', poNumber: 'PO-2026-0152', vendor: 'ABC Lumber Supply', job: 'Smith Residence', amount: 24500, status: 'Sent', eta: 'Feb 24' },
  { id: '2', poNumber: 'PO-2026-0153', vendor: 'PGT Industries', job: 'Johnson Beach House', amount: 45000, status: 'Partial', eta: 'Feb 25' },
  { id: '3', poNumber: 'PO-2026-0154', vendor: 'Coastal Roofing Supply', job: 'Harbor View Custom', amount: 16600, status: 'Sent', eta: 'Feb 26' },
  { id: '4', poNumber: 'PO-2026-0155', vendor: 'Jones Plumbing Supply', job: 'Smith Residence', amount: 12800, status: 'Received', eta: 'Delivered' },
  { id: '5', poNumber: 'PO-2026-0156', vendor: 'Smith Electric Supply', job: 'Miller Addition', amount: 9200, status: 'Sent', eta: 'Feb 28' },
]

const mockLeadTimeItems: LeadTimeItem[] = [
  { id: '1', name: 'Impact Windows', weeksRemaining: 6, severity: 'amber', job: 'Johnson Beach House' },
  { id: '2', name: 'Custom Cabinets', weeksRemaining: 4, severity: 'green', job: 'Smith Residence' },
  { id: '3', name: 'Appliances', weeksRemaining: 10, severity: 'red', job: 'Harbor View Custom' },
  { id: '4', name: 'Countertops', weeksRemaining: 3, severity: 'green', job: 'Smith Residence' },
]

// -- Helpers -----------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M'
  if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K'
  return '$' + value.toFixed(0)
}

const statusColors: Record<PurchaseOrderRow['status'], string> = {
  Sent: 'bg-stone-100 text-stone-700',
  Received: 'bg-green-100 text-green-700',
  Partial: 'bg-amber-100 text-amber-700',
}

const deliveryStatusColors: Record<DeliverySlot['status'], string> = {
  confirmed: 'bg-green-50 border-green-200',
  pending: 'bg-amber-50 border-amber-200',
  'in-transit': 'bg-stone-50 border-stone-200',
}

const deliveryStatusLabels: Record<DeliverySlot['status'], string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  'in-transit': 'In Transit',
}

const severityColors: Record<LeadTimeItem['severity'], { bg: string; text: string; bar: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
}

// -- Main Component ----------------------------------------------------------

export function ProcurementPreview(): React.ReactElement {
  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-warm-900 text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-warm-800 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Procurement & Supply Chain</h2>
            <p className="text-sm text-warm-400">
              PO workflows, delivery tracking, vendor management, and AI-powered order optimization
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-xs">
              <Package className="h-3.5 w-3.5" />
              Open POs
            </div>
            <div className="text-2xl font-bold text-stone-700 mt-1">18</div>
            <div className="text-xs text-stone-500">across 4 jobs</div>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-warm-600 text-xs">
              <Truck className="h-3.5 w-3.5" />
              Deliveries This Week
            </div>
            <div className="text-2xl font-bold text-warm-700 mt-1">7</div>
            <div className="text-xs text-warm-500">2 confirmed today</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              Backorders
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">3</div>
            <div className="text-xs text-amber-500">1 schedule risk</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Savings This Month
            </div>
            <div className="text-2xl font-bold text-green-700 mt-1">$4,200</div>
            <div className="text-xs text-green-500">from consolidation</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-stone-600 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance Rate
            </div>
            <div className="text-2xl font-bold text-stone-700 mt-1">92%</div>
            <div className="text-xs text-stone-500">vendor insurance</div>
          </div>
        </div>
      </div>

      {/* Delivery Calendar - Week View */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-warm-500" />
          <h3 className="font-semibold text-warm-900 text-sm">Delivery Calendar</h3>
          <span className="text-xs text-warm-500">Week of Feb 24 - Feb 28</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {mockWeekDays.map((day) => {
            const deliveries = mockDeliveryCalendar[day] || []
            const isToday = day === 'Mon 2/24'
            return (
              <div
                key={day}
                className={cn(
                  'rounded-lg border p-2 min-h-[120px]',
                  isToday ? 'border-stone-400 bg-stone-50' : 'border-warm-200 bg-warm-50/50'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-2',
                  isToday ? 'text-stone-700' : 'text-warm-500'
                )}>
                  {day}
                  {isToday && (
                    <span className="ml-1 text-[10px] bg-stone-600 text-white px-1.5 py-0.5 rounded">TODAY</span>
                  )}
                </div>
                {deliveries.length === 0 ? (
                  <div className="text-xs text-warm-400 italic">No deliveries</div>
                ) : (
                  <div className="space-y-1.5">
                    {deliveries.map((slot) => (
                      <div
                        key={slot.id}
                        className={cn(
                          'rounded border p-1.5 text-xs cursor-pointer hover:shadow-sm transition-shadow',
                          deliveryStatusColors[slot.status]
                        )}
                      >
                        <div className="font-medium text-warm-800 truncate">{slot.material}</div>
                        <div className="text-warm-500 truncate">{slot.jobName}</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-warm-400">{slot.time}</span>
                          <span className={cn(
                            'text-[10px] px-1 py-0.5 rounded font-medium',
                            slot.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            slot.status === 'in-transit' ? 'bg-stone-100 text-stone-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {deliveryStatusLabels[slot.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Active PO Table */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-warm-500" />
          <h3 className="font-semibold text-warm-900 text-sm">Active Purchase Orders</h3>
          <span className="text-xs text-warm-500">5 most recent</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-warm-200">
          <table className="w-full text-sm">
            <thead className="bg-warm-50">
              <tr>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-warm-500">PO #</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-warm-500">Vendor</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-warm-500">Job</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-warm-500">Amount</th>
                <th className="text-center py-2.5 px-3 text-xs font-medium text-warm-500">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-warm-500">ETA</th>
              </tr>
            </thead>
            <tbody>
              {mockPurchaseOrders.map((po) => (
                <tr key={po.id} className="border-t border-warm-100 hover:bg-warm-50 transition-colors cursor-pointer">
                  <td className="py-2.5 px-3 font-medium text-warm-900">{po.poNumber}</td>
                  <td className="py-2.5 px-3 text-warm-600">{po.vendor}</td>
                  <td className="py-2.5 px-3 text-warm-600">{po.job}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-warm-900">{formatCurrency(po.amount)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', statusColors[po.status])}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-warm-600 text-xs">
                    {po.eta === 'Delivered' ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Delivered
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-warm-400" />
                        {po.eta}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Order Consolidation */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-warm-900 text-sm">AI Order Consolidation</h3>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="font-medium text-amber-800 text-sm">Consolidation Opportunity Detected</div>
                <p className="text-sm text-amber-700 mt-1">
                  3 POs to <span className="font-medium">ABC Lumber Supply</span> across 3 jobs can be consolidated into a single order.
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-amber-600">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    PO-0152, PO-0158, PO-0161
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Smith, Johnson, Harbor View
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                    Save $300 delivery fee
                  </span>
                  <span className="text-xs text-amber-500">+ potential volume discount</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0">
              Consolidate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lead Time Tracker */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-4 w-4 text-warm-500" />
          <h3 className="font-semibold text-warm-900 text-sm">Lead Time Tracker</h3>
          <span className="text-xs text-warm-500">Long-lead items</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {mockLeadTimeItems.map((item) => {
            const colors = severityColors[item.severity]
            const maxWeeks = 12
            const pct = Math.min((item.weeksRemaining / maxWeeks) * 100, 100)
            return (
              <div key={item.id} className={cn('rounded-lg border p-3', colors.bg, 'border-warm-200')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-warm-900 text-sm">{item.name}</span>
                  <span className={cn('text-sm font-semibold', colors.text)}>
                    {item.weeksRemaining} weeks
                  </span>
                </div>
                <div className="text-xs text-warm-500 mb-2">{item.job}</div>
                <div className="w-full bg-warm-200 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', colors.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-warm-400">0 weeks</span>
                  <span className="text-[10px] text-warm-400">{maxWeeks} weeks</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-warm-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">Procurement Intelligence:</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-700">
            <span>Lumber prices up 8% -- lock pricing on open POs before Friday</span>
            <span className="text-amber-400">|</span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Appliance lead time extended to 10 weeks -- impacts Harbor View trim schedule
            </span>
            <span className="text-amber-400">|</span>
            <span>ABC Lumber consolidation saves $300+ across 3 jobs</span>
          </div>
        </div>
      </div>

      {/* AI Features Panel */}
      <div className="bg-white border-t border-warm-200 px-4 py-4">
        <AIFeaturesPanel
          title="Procurement AI Features"
          columns={2}
          features={[
            {
              feature: 'Order Consolidation',
              trigger: 'On creation',
              insight: 'Identifies orders to the same vendor across multiple jobs and suggests combining for volume discounts and reduced delivery fees.',
              severity: 'info',
              confidence: 94,
            },
            {
              feature: 'Lead Time Prediction',
              trigger: 'Real-time',
              insight: 'Predicts delivery dates based on vendor history, material type, and current supply chain conditions. Flags items that may delay construction schedule.',
              severity: 'warning',
              confidence: 88,
            },
            {
              feature: 'Price Intelligence',
              trigger: 'On change',
              insight: 'Compares unit prices against historical averages and market data. Alerts when pricing is above threshold or when better rates are available.',
              severity: 'info',
              confidence: 91,
            },
            {
              feature: 'Vendor Risk Scoring',
              trigger: 'Daily',
              insight: 'Scores vendors on on-time delivery, quality, pricing consistency, and insurance compliance. Recommends alternatives for underperforming suppliers.',
              severity: 'success',
              confidence: 86,
            },
          ]}
        />
      </div>
    </div>
  )
}
