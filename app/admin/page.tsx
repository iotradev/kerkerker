'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Visitor {
  device_id: string;
  current_page: string;
  page_title?: string;
  last_seen: string;
  first_seen: string;
  os?: string;
  device?: string;
  browser?: string;
  ip?: string;
}

interface Stats {
  online: number;
  total: number;
  today: number;
}

const OS_ICONS: Record<string, string> = {
  Windows: '🪟',
  macOS: '🍎',
  'Mac OS': '🍎',
  Linux: '🐧',
  Android: '🤖',
  iOS: '📱',
};

const BROWSER_ICONS: Record<string, string> = {
  Chrome: '🌐',
  Firefox: '🦊',
  Safari: '🧭',
  Edge: '🌍',
  'MIUI Browser': '📱',
};

const REFRESH_INTERVAL = 5000; // 5 秒自动刷新

export default function AdminPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<Stats>({ online: 0, total: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<{ days: number; count: number } | null>(null);

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await fetch('/api/track/visitors', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setVisitors(data.visitors || []);
      setStats(data.stats || { online: 0, total: 0, today: 0 });
      setLastUpdate(new Date());
    } catch {
      // 忽略网络错误，保持上次数据
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrune = async (days: number) => {
    if (!confirm(`删除 ${days} 天以上未活跃的访客记录？`)) return;
    setPruning(true);
    setPruneResult(null);
    try {
      const res = await fetch('/api/track/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (data.ok) {
        setPruneResult({ days, count: data.deleted_visitors });
        fetchVisitors();
      }
    } catch {
      // ignore
    } finally {
      setPruning(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
    const interval = setInterval(fetchVisitors, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchVisitors]);

  const now = Date.now();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">实时访客监控</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Realtime Visitor Dashboard
              {lastUpdate && (
                <span className="ml-2 text-xs text-gray-400">
                  · 更新于 {formatTime(lastUpdate)}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.online}</div>
              <div className="text-xs text-gray-500">在线</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
              <div className="text-xs text-gray-500">活跃</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
              <div className="text-xs text-gray-500">今日</div>
            </div>
            <button
              onClick={fetchVisitors}
              className="ml-2 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              刷新
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
              <button
                onClick={() => handlePrune(7)}
                disabled={pruning}
                className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {pruning ? '清理中...' : '7天'}
              </button>
              <button
                onClick={() => handlePrune(30)}
                disabled={pruning}
                className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              >
                30天
              </button>
              <span className="text-xs text-gray-400">清理</span>
              {pruneResult && (
                <span className="text-xs text-emerald-600">
                  已删除 {pruneResult.count} 条
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : visitors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="text-5xl mb-4">📡</div>
            <p className="text-gray-500 text-lg">暂无在线访客</p>
            <p className="text-gray-400 text-sm mt-1">等待用户访问你的网站...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      Device ID
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      系统
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      设备
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      浏览器
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      当前页面
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                      最后活跃
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visitors.map((v) => {
                    const lastSeen = new Date(v.last_seen).getTime();
                    const secondsAgo = Math.floor((now - lastSeen) / 1000);
                    const isOnline = secondsAgo <= 35;

                    return (
                      <tr
                        key={v.device_id}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isOnline
                                  ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                                  : 'bg-gray-300'
                              }`}
                            />
                            <Link
                              href={`/admin/${v.device_id}`}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {v.device_id.slice(0, 8)}...
                            </Link>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {OS_ICONS[v.os || ''] && `${OS_ICONS[v.os || '']} `}
                            {v.os || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 text-xs">
                          {v.device === 'mobile' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                              📱 Mobile
                            </span>
                          ) : v.device === 'tablet' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                              📟 Tablet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                              💻 {v.device || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {BROWSER_ICONS[v.browser || ''] &&
                              `${BROWSER_ICONS[v.browser || '']} `}
                            {v.browser || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-56">
                          {v.page_title ? (
                            <div>
                              <span className="text-xs text-gray-900 font-medium truncate block">
                                {v.page_title}
                              </span>
                              <span
                                className="font-mono text-[10px] text-gray-400 truncate block mt-0.5"
                                title={v.current_page}
                              >
                                {v.current_page}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="font-mono text-xs text-gray-600 truncate block"
                              title={v.current_page}
                            >
                              {v.current_page}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(secondsAgo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 5) return '刚刚';
  if (secondsAgo < 60) return `${secondsAgo} 秒前`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} 分钟前`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} 小时前`;
  return `${Math.floor(secondsAgo / 86400)} 天前`;
}
