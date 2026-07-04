'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const BOT_RE = /bot|crawl|spider|scrape|headless|slurp|facebook|twitter|discord|telegram|whatsapp/i;

const HEARTBEAT_INTERVAL = 30_000;
const DEBOUNCE_DELAY = 500;

/** 排除后台管理相关路径 */
const ADMIN_PATHS = [/^\/admin($|\/)/, /^\/login($|\/)/];

/** 路径转可读标签 */
const PAGE_LABELS: Record<string, string> = {
  '/': '首页',
  '/browse/latest': '最新',
  '/browse/movies': '电影',
  '/browse/tv': '电视剧',
  '/search': '搜索',
  '/calendar': '日历',
  '/dailymotion': 'Dailymotion',
};

function isAdminPath(path: string): boolean {
  return ADMIN_PATHS.some((re) => re.test(path));
}

function getPageLabel(path: string, title?: string): string {
  if (title) return title;
  // 精确匹配
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  // 匹配动态路由
  if (path.startsWith('/movie/')) return '电影详情';
  if (path.startsWith('/play/')) return '播放页';
  if (path.startsWith('/category/')) return '分类浏览';
  return path;
}

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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isBot()) return;
    deviceIdRef.current = getDeviceId();
  }, []);

  const sendHeartbeat = (page: string, t?: string) => {
    const device_id = deviceIdRef.current;
    if (!device_id) return;

    const label = getPageLabel(page, t);
    const body: Record<string, string> = { device_id, current_page: page, page_title: label };

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  };

  useEffect(() => {
    const page = pathname;
    if (isAdminPath(page)) return;
    if (page === lastPageRef.current && title === lastTitleRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastPageRef.current = page;
      lastTitleRef.current = title;
      sendHeartbeat(page, title);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pathname, title]);

  useEffect(() => {
    if (isBot() || isAdminPath(pathname)) return;

    const interval = setInterval(() => {
      sendHeartbeat(pathname, title);
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [pathname, title]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAdminPath(pathname)) return;
      sendHeartbeat(pathname, title);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isAdminPath(pathname)) {
        sendHeartbeat(pathname, title);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname, title]);
}
