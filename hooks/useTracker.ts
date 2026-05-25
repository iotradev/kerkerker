'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const BOT_RE = /bot|crawl|spider|scrape|headless|slurp|facebook|twitter|discord|telegram|whatsapp/i;

function isBot(): boolean {
  if (typeof navigator === 'undefined') return true;
  return BOT_RE.test(navigator.userAgent);
}

function getDeviceId(): string {
  const key = 'track_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function useTracker(title?: string) {
  const pathname = usePathname();
  const deviceIdRef = useRef<string>('');
  const lastPageRef = useRef<string>('');
  const lastTitleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isBot()) return;
    deviceIdRef.current = getDeviceId();
  }, []);

  const sendHeartbeat = (page: string, t?: string) => {
    const device_id = deviceIdRef.current;
    if (!device_id) return;

    const body: Record<string, string> = { device_id, current_page: page };
    if (t) body.page_title = t;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  };

  useEffect(() => {
    const page = pathname;
    if (page === lastPageRef.current && title === lastTitleRef.current) return;
    lastPageRef.current = page;
    lastTitleRef.current = title;
    sendHeartbeat(page, title);
  }, [pathname, title]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sendHeartbeat(pathname, title);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pathname, title]);
}
