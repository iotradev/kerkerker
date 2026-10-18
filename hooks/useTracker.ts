'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isLikelyBotUa } from '@/lib/track/bot-filter';

const HEARTBEAT_INTERVAL = 30_000;
const DEBOUNCE_DELAY = 500;
/** 上报失败后的重试延迟与队列上限（page_view_id 服务端幂等，重复上报不会重复计数） */
const RETRY_DELAY = 3_000;
const RETRY_QUEUE_MAX = 10;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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
  if (path.startsWith('/history')) return '观看历史';
  if (path.startsWith('/shorts')) return '短剧';
  return path;
}

function isBot(): boolean {
  if (typeof navigator === 'undefined') return true;
  return isLikelyBotUa(navigator.userAgent);
}

function getDeviceId(): string {
  const key = 'track_device_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = createId();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return createId();
  }
}

/** 会话 ID：每个标签页/浏览器会话一份，用于统计会话数 */
function getSessionId(fallbackId: string): string {
  const key = 'track_session_v2';
  const now = Date.now();
  try {
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) as { id?: string; lastSeen?: number } : null;
    const id = existing?.id && typeof existing.lastSeen === 'number' && now - existing.lastSeen < 30 * 60_000
      ? existing.id
      : createId();
    localStorage.setItem(key, JSON.stringify({ id, lastSeen: now }));
    return id;
  } catch {
    return fallbackId;
  }
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
  const fallbackSessionIdRef = useRef(createId());
  const pageViewRef = useRef<{ path: string; id: string }>({ path: '', id: '' });
  const lastPageRef = useRef<string>('');
  const lastTitleRef = useRef<string | undefined>(undefined);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 防抖已排期但尚未发送的浏览（切换页面时补发，避免快速跳出漏记） */
  const pendingRef = useRef<{ path: string; title?: string; sent: boolean } | null>(null);
  const retryQueueRef = useRef<Record<string, string>[]>([]);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isBot()) return;
    deviceIdRef.current = getDeviceId();
  }, []);

  /** 上报一次；失败时进入重试队列（page_view_id 幂等，重复上报不会重复计数） */
  const postEvent = (body: Record<string, string>) => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      if (retryQueueRef.current.length < RETRY_QUEUE_MAX) {
        retryQueueRef.current.push(body);
      }
      if (retryTimerRef.current) return;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const pending = retryQueueRef.current.splice(0);
        pending.forEach((item) => {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            keepalive: true,
          }).catch(() => {
            // 二次失败放弃，避免无限重试
          });
        });
      }, RETRY_DELAY);
    });
  };

  /** 发送指定页面的浏览事件；page_view_id 按路径分配，服务端按唯一索引去重 */
  const sendPageView = (page: string, pageTitle?: string) => {
    const device_id = deviceIdRef.current;
    if (!device_id) return;

    if (pageViewRef.current.path !== page) {
      pageViewRef.current = { path: page, id: createId() };
    }

    const label = getPageLabel(page, pageTitle);
    const body: Record<string, string> = {
      device_id,
      current_page: page,
      page_view_id: pageViewRef.current.id,
      page_title: label,
      track_token: getTrackToken(),
      session_id: getSessionId(fallbackSessionIdRef.current),
      ...getClientMeta(),
    };

    postEvent(body);
  };

  /** 发送当前页心跳（复用已有 page_view_id，只刷新 last_seen） */
  const sendHeartbeat = (page: string, pageTitle?: string) => {
    const device_id = deviceIdRef.current;
    if (!device_id) return;

    const label = getPageLabel(page, pageTitle);
    const body: Record<string, string> = {
      device_id,
      current_page: page,
      page_view_id: pageViewRef.current.id,
      page_title: label,
      track_token: getTrackToken(),
      session_id: getSessionId(fallbackSessionIdRef.current),
      ...getClientMeta(),
    };

    postEvent(body);
  };

  useEffect(() => {
    const page = pathname;
    if (isAdminPath(page)) return;
    if (page === lastPageRef.current && title === lastTitleRef.current) return;

    // 防抖尚未触发就被切到其他页面：立即补发被取消的浏览记录
    const prev = pendingRef.current;
    if (prev && !prev.sent && prev.path !== page) {
      prev.sent = true;
      sendPageView(prev.path, prev.title);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    pendingRef.current = { path: page, title, sent: false };
    debounceTimerRef.current = setTimeout(() => {
      lastPageRef.current = page;
      lastTitleRef.current = title;
      if (pendingRef.current && pendingRef.current.path === page) {
        pendingRef.current.sent = true;
      }
      sendPageView(page, title);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [pathname, title]);

  // 组件卸载（应用整体离开）时补发未上报的浏览；beforeunload 覆盖硬跳转
  useEffect(() => {
    return () => {
      const prev = pendingRef.current;
      if (prev && !prev.sent) {
        prev.sent = true;
        sendPageView(prev.path, prev.title);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isBot() || isAdminPath(pathname)) return;

    const interval = setInterval(() => {
      sendHeartbeat(pathname, title);
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [pathname, title]);

  useEffect(() => {
    if (isBot() || isAdminPath(pathname)) return;

    const handleBeforeUnload = () => {
      sendHeartbeat(pathname, title);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
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
