/**
 * Mobile Photos Page
 * Phase 1.1c: Photo capture with AI tagging
 */

import { MobileLayout } from '@/components/mobile/layout';
import { PhotoCapture } from '@/components/mobile/photos';

export default function MobilePhotos() {
  return (
    <MobileLayout title="Photo Capture" showLocationIndicator={true}>
      <div className="p-4">
        <PhotoCapture />
      </div>
    </MobileLayout>
  );
}
