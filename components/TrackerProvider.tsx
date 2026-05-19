'use client';

import { useTracker } from '@/hooks/useTracker';

export function TrackerProvider() {
  useTracker();
  return null;
}
