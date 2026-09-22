'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Visitor {
  device_id: string;
  current_page: string;
  page_title?: string;
  last_seen: string;
  first_seen: string;
  first_page?: string;
  os?: string;
  os_version?: string;
  device?: string;
  device_vendor?: string;
  device_model?: string;
  browser?: string;
  browser_version?: string;
  ip?: string;
  language?: string;
  screen?: string;
  timezone?: string;
  referrer?: string;
  referrer_host?: string;
  page_views?: number;
  session_count?: number;
}

interface Stats {
  online: number;
  online_all?: number;
  total: number;
  today: number;
  today_new?: number;
  today_returning?: number;
  all_time?: number;
  unique_ips?: number;
  total_page_views?: number;
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
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<Stats>({ online: 0, total: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [scope, setScope] = useState<'realtime' | 'history'>('realtime');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<{ days: number; count: number } | null>(null);

  const fetchVisitors = useCallback(async () => {
    try {
      const params = new URLSearchParams({ scope });
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/track/visitors?${params.toString()}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.push(`/login?redirect=/admin`);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setVisitors(data.visitors || []);
      setStats(data.stats || { online: 0, total: 0, today: 0 });
      setLastUpdate(new Date());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [scope, query, router]);

  const handleDelete = async (deviceId: string) => {
    if (!confirm(`删除访客 ${deviceId.slice(0, 8)}... 的记录（含浏览日志）？`)) return;
    setDeleting(deviceId);
    try {
      const res = await fetch(`/api/track/${deviceId}/delete`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setVisitors((prev) => prev.filter((v) => v.device_id !== deviceId));
        setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const handlePrune = async (days: number) => {
    if (!confirm(`删除 ${days} 天以上未活跃的访客及其浏览日志？`)) return;
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
    if (scope === 'realtime' && !query.trim()) {
      const interval = setInterval(fetchVisitors, REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchVisitors, scope, query]);

  const now = Date.now();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {scope === 'history' ? '访客列表' : '实时访客监控'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {scope === 'history' ? 'All-time Visitors' : 'Realtime Visitor Dashboard'}
              {lastUpdate && (
                <span className="ml-2 text-xs text-gray-400">
                  · 更新于 {formatTime(lastUpdate)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setScope('realtime')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${scope === 'realtime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                实时
              </button>
              <button
                onClick={() => setScope('history')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${scope === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                全部
              </button>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 ID / IP / 页面 / 系统..."
              className="w-56 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <StatChip label="在线" value={stats.online} color="text-emerald-600" />
            <StatChip label={scope === 'history' ? '总记录' : '活跃'} value={stats.total} color="text-gray-700" />
            <StatChip label="今日" value={stats.today} color="text-blue-600" />
            <StatChip label="新访客" value={stats.today_new ?? 0} color="text-indigo-600" />
            <StatChip label="回访" value={stats.today_returning ?? 0} color="text-amber-600" />
            <StatChip label="累计设备" value={stats.all_time ?? 0} color="text-gray-700" />
            <StatChip label="独立 IP" value={stats.unique_ips ?? 0} color="text-slate-600" />
            <StatChip label="总浏览" value={stats.total_page_views ?? 0} color="text-purple-600" />
            <button
              onClick={fetchVisitors}
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              刷新
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
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
            <p className="text-gray-500 text-lg">
              {query ? '没有匹配的访客' : scope === 'history' ? '暂无访客记录' : '暂无在线访客'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {query ? '换个关键词试试' : scope === 'history' ? '等待用户首次访问你的网站...' : '等待用户访问你的网站...'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Device</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">系统 / 设备</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">浏览器</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">IP / 语言</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">当前页面</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">来源</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">访问</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">最后活跃</th>
                    <th className="text-right px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">操作</th>
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
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isOnline
                                  ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                                  : 'bg-gray-300'
                              }`}
                            />
                            <div>
                              <Link
                                href={`/admin/${v.device_id}`}
                                className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {v.device_id.slice(0, 8)}...
                              </Link>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                首次 {formatShortDate(v.first_seen)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium w-fit">
                              {OS_ICONS[v.os || ''] && `${OS_ICONS[v.os || '']} `}
                              {v.os || '-'}
                              {v.os_version ? ` ${v.os_version}` : ''}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {formatDeviceLabel(v)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {BROWSER_ICONS[v.browser || ''] &&
                              `${BROWSER_ICONS[v.browser || '']} `}
                            {v.browser || '-'}
                            {v.browser_version ? ` ${v.browser_version.split('.')[0]}` : ''}
                          </span>
                          {v.screen && (
                            <div className="text-[10px] text-gray-400 mt-1">{v.screen}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-xs text-gray-700">{v.ip || '-'}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {v.language || '-'}
                            {v.timezone ? ` · ${v.timezone}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-48">
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
                        <td className="px-4 py-3.5 max-w-36">
                          {v.referrer_host ? (
                            <div>
                              <span className="text-xs text-gray-700 truncate block">
                                {v.referrer_host}
                              </span>
                              {v.first_page && (
                                <span className="text-[10px] text-gray-400 truncate block mt-0.5">
                                  入口 {v.first_page}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">直接访问</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-xs text-gray-800 font-medium">
                            {v.page_views ?? 0} PV
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {v.session_count ?? 0} 会话
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(secondsAgo)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/admin/${v.device_id}`}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            >
                              详情
                            </Link>
                            <button
                              onClick={() => handleDelete(v.device_id)}
                              disabled={deleting === v.device_id}
                              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            >
                              {deleting === v.device_id ? '...' : '删除'}
                            </button>
                          </div>
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

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center min-w-[52px]">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function formatDeviceLabel(v: Visitor): string {
  const parts: string[] = [];
  if (v.device === 'mobile') parts.push('📱 Mobile');
  else if (v.device === 'tablet') parts.push('📟 Tablet');
  else parts.push(`💻 ${v.device || 'Desktop'}`);
  if (v.device_vendor) parts.push(v.device_vendor);
  if (v.device_model) parts.push(v.device_model);
  return parts.join(' ');
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatShortDate(value: string | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 5) return '刚刚';
  if (secondsAgo < 60) return `${secondsAgo} 秒前`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} 分钟前`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} 小时前`;
  return `${Math.floor(secondsAgo / 86400)} 天前`;
}
