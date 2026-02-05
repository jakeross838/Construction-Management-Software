/**
 * Mobile Time Clock Page
 * Phase 1.1b: Time tracking with GPS
 */

import { MobileLayout } from '@/components/mobile/layout';
import { TimeClock } from '@/components/mobile/timeclock';

export default function MobileTimeClock() {
  return (
    <MobileLayout title="Time Clock" showLocationIndicator={true}>
      <div className="p-4">
        <TimeClock />
      </div>
    </MobileLayout>
  );
}
