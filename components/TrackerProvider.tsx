'use client';

import { useTracker } from '@/hooks/useTracker';
import { usePageTitle } from '@/hooks/PageTitleContext';

export function TrackerProvider() {
  const { pageTitle } = usePageTitle();
  useTracker(pageTitle);
  return null;
}
