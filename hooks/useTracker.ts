'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const BOT_RE = /bot|crawl|spider|scrape|headless|slurp|facebook|twitter|discord|telegram|whatsapp/i;

const HEARTBEAT_INTERVAL = 30_000;
const DEBOUNCE_DELAY = 500;

/** 从页面 meta 标签读取追踪令牌 */
function getTrackToken(): string {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="track-token"]');
  return meta?.getAttribute('content') || '';
}

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
  if (path.startsWith('/browse/')) return '分类浏览';
  if (path.startsWith('/history/')) return '观看历史';
  if (path.startsWith('/shorts')) return '短剧';
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

/** 会话 ID：每个标签页/浏览器会话一份，用于统计会话数 */
function getSessionId(): string {
  const key = 'track_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/** 采集客户端环境信息（语言、屏幕、时区、来源等） */
function getClientMeta(): Record<string, string> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }
  return {
    referrer: document.referrer || '',
    language: navigator.language || '',
    languages: (navigator.languages || []).join(','),
    screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    tz_offset: String(new Date().getTimezoneOffset()),
  };
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
    const body: Record<string, string> = {
      device_id,
      current_page: page,
      page_title: label,
      track_token: getTrackToken(),
      session_id: getSessionId(),
      ...getClientMeta(),
    };

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
