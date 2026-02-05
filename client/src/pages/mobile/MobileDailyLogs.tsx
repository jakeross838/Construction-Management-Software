/**
 * Mobile Daily Logs Page
 * Phase 1.1d: Daily logs with voice input
 */

import { MobileLayout } from '@/components/mobile/layout';
import { DailyLogForm } from '@/components/mobile/dailylogs';

export default function MobileDailyLogs() {
  return (
    <MobileLayout title="Daily Log">
      <div className="p-4">
        <DailyLogForm />
      </div>
    </MobileLayout>
  );
}
