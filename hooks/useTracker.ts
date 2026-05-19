'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function getDeviceId(): string {
  const key = 'track_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

const HEARTBEAT_INTERVAL = 30000;

export function useTracker() {
  const pathname = usePathname();
  const deviceIdRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = (page: string) => {
    const device_id = deviceIdRef.current;
    if (!device_id) return;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id, current_page: page }),
      keepalive: true,
    }).catch(() => {});
  };

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
  }, []);

  useEffect(() => {
    const page = pathname;

    sendHeartbeat(page);

    intervalRef.current = setInterval(() => {
      sendHeartbeat(page);
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pathname]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sendHeartbeat(pathname);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pathname]);
}
