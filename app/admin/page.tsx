'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Users,
  Activity,
  UserPlus,
  Repeat2,
  Network,
  MousePointerClick,
  History,
  Radio,
  X,
} from 'lucide-react';
import { Toast, ConfirmDialog } from '@/components/Toast';
import type { ToastState, ConfirmState } from '@/components/admin/types';

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

const REFRESH_INTERVAL = 5000;

export default function AdminPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<Stats>({ online: 0, total: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [scope, setScope] = useState<'realtime' | 'history'>('realtime');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchVisitors = useCallback(async () => {
    try {
      const params = new URLSearchParams({ scope });
      if (debouncedQuery) params.set('q', debouncedQuery);
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
  }, [scope, debouncedQuery, router]);

  const handleDelete = (deviceId: string) => {
    setConfirm({
      title: '删除访客',
      message: `删除访客 ${deviceId.slice(0, 8)}... 的记录（含浏览日志）？此操作不可恢复。`,
      danger: true,
      confirmText: '删除',
      onConfirm: async () => {
        setDeleting(deviceId);
        try {
          const res = await fetch(`/api/track/${deviceId}/delete`, { method: 'DELETE' });
          const data = await res.json();
          if (data.ok) {
            setVisitors((prev) => prev.filter((v) => v.device_id !== deviceId));
            setStats((prev) => ({
              ...prev,
              total: Math.max(0, prev.total - 1),
              all_time: Math.max(0, (prev.all_time ?? 0) - 1),
            }));
            setToast({ message: '已删除访客记录', type: 'success' });
          } else {
            setToast({ message: data.error || '删除失败', type: 'error' });
          }
        } catch {
          setToast({ message: '网络错误，删除失败', type: 'error' });
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const handlePrune = (days: number) => {
    setConfirm({
      title: '清理访客',
      message: `删除 ${days} 天以上未活跃的访客及其浏览日志？此操作不可恢复。`,
      danger: true,
      confirmText: '清理',
      onConfirm: async () => {
        setPruning(true);
        try {
          const res = await fetch('/api/track/prune', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days }),
          });
          const data = await res.json();
          if (data.ok) {
            setToast({
              message: `已删除 ${data.deleted_visitors} 条访客 / ${data.deleted_logs ?? 0} 条日志`,
              type: 'success',
            });
            fetchVisitors();
          } else {
            setToast({ message: data.error || '清理失败', type: 'error' });
          }
        } catch {
          setToast({ message: '网络错误，清理失败', type: 'error' });
        } finally {
          setPruning(false);
        }
      },
    });
  };

  useEffect(() => {
    fetchVisitors();
    if (scope === 'realtime' && !debouncedQuery) {
      const interval = setInterval(fetchVisitors, REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchVisitors, scope, debouncedQuery]);

  const now = Date.now();

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Header - Netflix Style */}
      <header className="bg-[#141414] border-b border-[#333] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/settings" className="text-2xl font-bold text-[#E50914] hover:opacity-90 transition-opacity">
                壳儿
              </Link>
              <div className="h-6 w-px bg-[#333]" />
              <div>
                <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Radio size={18} className="text-[#E50914]" />
                  {scope === 'history' ? '访客列表' : '实时访客监控'}
                </h1>
                <p className="text-xs text-[#808080] mt-0.5">
                  {lastUpdate ? `更新于 ${formatTime(lastUpdate)}` : 'Realtime Visitor Dashboard'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Scope 切换 */}
              <div className="flex items-center gap-1 bg-[#1f1f1f] rounded-lg p-0.5 border border-[#333]">
                <button
                  onClick={() => setScope('realtime')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    scope === 'realtime' ? 'bg-[#E50914] text-white' : 'text-[#808080] hover:text-white'
                  }`}
                >
                  实时
                </button>
                <button
                  onClick={() => setScope('history')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    scope === 'history' ? 'bg-[#E50914] text-white' : 'text-[#808080] hover:text-white'
                  }`}
                >
                  全部
                </button>
              </div>

              {/* 搜索 */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#808080]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 ID / IP / 页面..."
                  className="w-48 sm:w-56 pl-8 pr-8 py-1.5 text-xs bg-[#1f1f1f] border border-[#333] rounded-lg text-white placeholder:text-[#666] focus:outline-none focus:border-[#E50914]/60 focus:ring-1 focus:ring-[#E50914]/30 transition-colors"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                onClick={fetchVisitors}
                className="px-3 py-1.5 text-xs text-white bg-[#333] hover:bg-[#444] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                刷新
              </button>

              <div className="flex items-center gap-1 border-l border-[#333] pl-3">
                <button
                  onClick={() => handlePrune(7)}
                  disabled={pruning}
                  className="px-2.5 py-1.5 text-xs text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {pruning ? '清理中…' : '7天'}
                </button>
                <button
                  onClick={() => handlePrune(30)}
                  disabled={pruning}
                  className="px-2.5 py-1.5 text-xs text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  30天
                </button>
                <span className="text-[10px] text-[#666] ml-0.5">清理</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI 指标卡 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          <KpiCard
            icon={<Activity size={16} className="text-emerald-400" />}
            label="在线"
            value={stats.online}
            accent="text-emerald-400"
            highlight
          />
          <KpiCard
            icon={<Eye size={16} className="text-white" />}
            label={scope === 'history' ? '总记录' : '活跃'}
            value={stats.total}
          />
          <KpiCard
            icon={<Users size={16} className="text-blue-400" />}
            label="今日"
            value={stats.today}
            accent="text-blue-400"
          />
          <KpiCard
            icon={<UserPlus size={16} className="text-indigo-400" />}
            label="新访客"
            value={stats.today_new ?? 0}
            accent="text-indigo-400"
          />
          <KpiCard
            icon={<Repeat2 size={16} className="text-amber-400" />}
            label="回访"
            value={stats.today_returning ?? 0}
            accent="text-amber-400"
          />
          <KpiCard
            icon={<History size={16} className="text-[#808080]" />}
            label="累计设备"
            value={stats.all_time ?? 0}
            accent="text-[#b3b3b3]"
          />
          <KpiCard
            icon={<Network size={16} className="text-slate-300" />}
            label="独立 IP"
            value={stats.unique_ips ?? 0}
            accent="text-slate-300"
          />
          <KpiCard
            icon={<MousePointerClick size={16} className="text-purple-400" />}
            label="总浏览"
            value={stats.total_page_views ?? 0}
            accent="text-purple-400"
          />
        </section>

        {/* 列表 */}
        {loading ? (
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#333] bg-[#1f1f1f]">
              <div className="h-4 w-24 bg-[#2a2a2a] rounded animate-pulse" />
            </div>
            <div className="divide-y divide-[#2a2a2a]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                  <div className="h-3 w-28 bg-[#2a2a2a] rounded" />
                  <div className="h-3 w-20 bg-[#2a2a2a] rounded" />
                  <div className="h-3 w-16 bg-[#2a2a2a] rounded" />
                  <div className="h-3 w-24 bg-[#2a2a2a] rounded" />
                  <div className="h-3 flex-1 bg-[#2a2a2a] rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-16 text-center">
            <Radio size={48} className="mx-auto mb-4 text-[#E50914]/70" strokeWidth={1.2} />
            <p className="text-[#b3b3b3] text-lg">
              {debouncedQuery ? '没有匹配的访客' : scope === 'history' ? '暂无访客记录' : '暂无在线访客'}
            </p>
            <p className="text-[#666] text-sm mt-1">
              {debouncedQuery ? '换个关键词试试' : '等待用户访问你的网站...'}
            </p>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1f1f1f] border-b border-[#333]">
                    {['Device', '系统 / 设备', '浏览器', 'IP / 语言', '当前页面', '来源', '访问', '最后活跃', '操作'].map(
                      (head, i) => (
                        <th
                          key={head}
                          className={`px-4 py-3.5 font-semibold text-[#808080] text-[11px] uppercase tracking-wider ${
                            i === 8 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {visitors.map((v) => {
                    const lastSeen = new Date(v.last_seen).getTime();
                    const secondsAgo = Math.floor((now - lastSeen) / 1000);
                    const isOnline = secondsAgo <= 35;

                    return (
                      <tr
                        key={v.device_id}
                        className={`transition-colors ${isOnline ? 'bg-emerald-500/[0.04]' : ''} hover:bg-[#222]`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {isOnline ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                              </span>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-[#444]" />
                            )}
                            <div>
                              <Link
                                href={`/admin/${v.device_id}`}
                                className="font-mono text-xs text-white hover:text-[#E50914] transition-colors"
                              >
                                {v.device_id.slice(0, 8)}…
                              </Link>
                              <div className="text-[10px] text-[#666] mt-0.5">
                                首次 {formatShortDate(v.first_seen)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#b3b3b3] text-[11px] font-medium w-fit">
                              {deviceIcon(v.device)}
                              {v.os || '-'}
                              {v.os_version ? ` ${v.os_version}` : ''}
                            </span>
                            <span className="text-[10px] text-[#666]">{formatDeviceLabel(v)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#b3b3b3] text-[11px] font-medium">
                            <Globe size={12} className="text-[#808080]" />
                            {v.browser || '-'}
                            {v.browser_version ? ` ${v.browser_version.split('.')[0]}` : ''}
                          </span>
                          {v.screen && (
                            <div className="text-[10px] text-[#666] mt-1 font-mono">{v.screen}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-xs text-[#b3b3b3]">{v.ip || '-'}</div>
                          <div className="text-[10px] text-[#666] mt-0.5">
                            {v.language || '-'}
                            {v.timezone ? ` · ${v.timezone}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-48">
                          {v.page_title ? (
                            <div>
                              <span className="text-xs text-white font-medium truncate block">{v.page_title}</span>
                              <span className="font-mono text-[10px] text-[#666] truncate block mt-0.5" title={v.current_page}>
                                {v.current_page}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-[#808080] truncate block" title={v.current_page}>
                              {v.current_page}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-36">
                          {v.referrer_host ? (
                            <div>
                              <span className="text-xs text-[#b3b3b3] truncate block">{v.referrer_host}</span>
                              {v.first_page && (
                                <span className="text-[10px] text-[#666] truncate block mt-0.5">入口 {v.first_page}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#666]">直接访问</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-xs text-white font-medium">{v.page_views ?? 0} PV</div>
                          <div className="text-[10px] text-[#666]">{v.session_count ?? 0} 会话</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#808080] whitespace-nowrap">
                          {formatRelativeTime(secondsAgo)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/admin/${v.device_id}`}
                              className="p-1.5 text-[#808080] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
                              title="详情"
                            >
                              <Eye size={14} />
                            </Link>
                            <button
                              onClick={() => handleDelete(v.device_id)}
                              disabled={deleting === v.device_id}
                              className="p-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors disabled:opacity-50"
                              title="删除"
                            >
                              {deleting === v.device_id ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger={confirm.danger}
          confirmText={confirm.confirmText}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent = 'text-white',
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 bg-[#1a1a1a] transition-colors ${
        highlight ? 'border-emerald-600/40' : 'border-[#333]'
      } hover:border-[#444]`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 text-[#808080]">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function deviceIcon(device?: string) {
  if (device === 'mobile') return <Smartphone size={12} className="text-violet-400" />;
  if (device === 'tablet') return <Tablet size={12} className="text-violet-400" />;
  return <Monitor size={12} className="text-slate-400" />;
}

function formatDeviceLabel(v: Visitor): string {
  const parts: string[] = [];
  if (v.device === 'mobile') parts.push('Mobile');
  else if (v.device === 'tablet') parts.push('Tablet');
  else parts.push(v.device || 'Desktop');
  if (v.device_vendor) parts.push(v.device_vendor);
  if (v.device_model) parts.push(v.device_model);
  return parts.join(' · ');
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
