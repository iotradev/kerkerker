'use client';

import { useContext } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { PageTitleContext } from '@/hooks/PageTitleContext';

export function TrackerProvider() {
  const { pageTitle } = useContext(PageTitleContext);
  useTracker(pageTitle);
  return null;
}
