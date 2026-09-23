'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  MapPin,
  Languages,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  Fingerprint,
  Layers,
  MousePointerClick,
  History,
  Timer,
  FileText,
  Link2,
  Radio,
  MonitorSmartphone,
  Home,
} from 'lucide-react';

interface Device {
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
  languages?: string;
  screen?: string;
  viewport?: string;
  timezone?: string;
  tz_offset?: string;
  referrer?: string;
  referrer_host?: string;
  ua?: string;
  page_views?: number;
  session_count?: number;
}

interface PageLogEntry {
  path: string;
  page_title?: string;
  ts: string;
  session_id?: string;
  referrer?: string;
}

interface Insights {
  page_views: number;
  unique_pages: number;
  session_count: number;
  activity_ms: number;
  first_ts?: string | null;
  last_ts?: string | null;
  top_pages: Array<{
    path: string;
    page_title?: string;
    count: number;
    last_ts: string;
  }>;
}

const REFRESH_INTERVAL = 5000;

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const device_id = (params.device_id as string) || '';

  const [device, setDevice] = useState<Device | null>(null);
  const [pageLog, setPageLog] = useState<PageLogEntry[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${device_id}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.push(`/login?redirect=/admin/${device_id}`);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setDevice(data.device || null);
      setIsOnline(data.isOnline || false);
      setPageLog(data.pageLog || []);
      setInsights(data.insights || null);
    } catch {
      // 忽略网络错误
    } finally {
      setLoading(false);
    }
  }, [device_id, router]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#444] border-t-[#E50914] mx-auto mb-3" />
          <p className="text-[#808080] text-sm">加载设备详情…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="bg-[#141414] border-b border-[#333] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-[#808080] hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              看板
            </Link>
            <span className="text-[#333]">/</span>
            <h1 className="text-lg font-semibold text-white">设备详情</h1>
            <Link href="/admin/settings" className="text-2xl font-bold text-[#E50914] ml-2 hidden sm:block hover:opacity-90">
              壳儿
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-600/40'
                  : 'text-[#808080] bg-[#1f1f1f] border-[#333]'
              }`}
            >
              {isOnline ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-[#444]" />
              )}
              {isOnline ? '在线' : '离线'}
            </div>
            <Link
              href="/"
              className="px-3 py-1.5 text-xs text-white bg-[#E50914] hover:bg-[#B20710] rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Home size={13} />
              回到前台
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 概览 */}
        <section className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="font-mono text-xs text-[#808080] break-all">{device_id}</p>
              {device?.page_title && (
                <p className="text-sm text-white mt-1 font-medium">当前：{device.page_title}</p>
              )}
            </div>
            {device?.ua && (
              <details className="text-xs text-[#808080] shrink-0">
                <summary className="cursor-pointer select-none hover:text-white transition-colors">UA</summary>
                <p className="mt-2 font-mono text-[11px] text-[#b3b3b3] break-all max-w-md bg-[#141414] rounded-lg p-3 border border-[#333]">
                  {device.ua}
                </p>
              </details>
            )}
          </div>

          {insights && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Metric
                icon={<MousePointerClick size={14} className="text-purple-400" />}
                label="页面浏览"
                value={`${insights.page_views} PV`}
              />
              <Metric
                icon={<Layers size={14} className="text-blue-400" />}
                label="独立页面"
                value={`${insights.unique_pages}`}
              />
              <Metric
                icon={<History size={14} className="text-amber-400" />}
                label="会话数"
                value={`${insights.session_count}`}
              />
              <Metric
                icon={<Timer size={14} className="text-emerald-400" />}
                label="活跃跨度"
                value={formatDuration(insights.activity_ms)}
              />
            </div>
          )}

          {device ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
              <Field icon={<Monitor size={13} />} label="操作系统" value={[device.os, device.os_version].filter(Boolean).join(' ') || '-'} />
              <Field
                icon={device.device === 'mobile' ? <Smartphone size={13} /> : device.device === 'tablet' ? <Tablet size={13} /> : <MonitorSmartphone size={13} />}
                label="设备类型"
                value={formatDevice(device)}
              />
              <Field icon={<Globe size={13} />} label="浏览器" value={[device.browser, device.browser_version].filter(Boolean).join(' ') || '-'} />
              <Field icon={<Fingerprint size={13} />} label="IP" value={device.ip || '-'} mono />
              <Field icon={<Languages size={13} />} label="语言" value={device.language || '-'} />
              <Field icon={<MapPin size={13} />} label="屏幕 / 视口" value={[device.screen, device.viewport].filter(Boolean).join(' · ') || '-'} mono />
              <Field icon={<Clock size={13} />} label="时区" value={device.timezone || '-'} />
              <Field icon={<Link2 size={13} />} label="来源" value={device.referrer_host || '直接访问'} />
              <Field icon={<FileText size={13} />} label="落地页" value={device.first_page || '-'} mono />
              <Field icon={<History size={13} />} label="首次访问" value={device.first_seen ? fmtTime(device.first_seen) : '-'} />
              <Field icon={<Timer size={13} />} label="最后活跃" value={device.last_seen ? fmtTime(device.last_seen) : '-'} />
              <Field icon={<Radio size={13} />} label="当前页面" value={device.current_page || '-'} mono />
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-[#666]">设备记录已过期</p>
            </div>
          )}
        </section>

        {/* 热门页面 */}
        {insights && insights.top_pages.length > 0 && (
          <section className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#333] flex items-center gap-2">
              <Layers size={16} className="text-blue-400" />
              <h2 className="font-semibold text-white text-sm">访问最多的页面</h2>
            </div>
            <div className="p-5 space-y-3">
              {insights.top_pages.map((p, i) => {
                const max = insights.top_pages[0]?.count || 1;
                const ratio = Math.round((p.count / max) * 100);
                return (
                  <div key={`${p.path}-${i}`}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <div className="text-xs text-white font-medium truncate">
                          {p.page_title || p.path}
                        </div>
                        <div className="font-mono text-[10px] text-[#666] truncate">{p.path}</div>
                      </div>
                      <div className="text-xs text-[#b3b3b3] tabular-nums shrink-0">{p.count} 次</div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#E50914] to-red-500/80"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 访问时间轴 */}
        <section className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-amber-400" />
              <h2 className="font-semibold text-white text-sm">页面访问历史</h2>
              <span className="text-[10px] text-[#666] bg-[#2a2a2a] px-2 py-0.5 rounded-full">
                最近 {pageLog.length} 条
              </span>
            </div>
          </div>

          {pageLog.length === 0 ? (
            <div className="p-12 text-center">
              <History size={40} className="mx-auto mb-3 text-[#444]" strokeWidth={1.2} />
              <p className="text-[#666] text-sm">暂无访问记录</p>
            </div>
          ) : (
            <ol className="relative px-5 py-5 ml-2 space-y-0">
              {/* 竖线 */}
              <span className="absolute left-[27px] top-6 bottom-6 w-px bg-[#2a2a2a]" aria-hidden />
              {pageLog.map((log, i) => {
                const prev = pageLog[i - 1];
                const newSession = log.session_id && (!prev || prev.session_id !== log.session_id);
                return (
                  <li key={i} className="relative pl-10 pb-6 last:pb-0 group">
                    {/* 节点 */}
                    <span
                      className={`absolute left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#1a1a1a] ${
                        i === 0 ? 'bg-[#E50914]' : 'bg-[#444] group-hover:bg-[#666] transition-colors'
                      }`}
                    />
                    {newSession && (
                      <div className="mb-2 -ml-10 pl-10">
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-600/30 px-2 py-0.5 rounded-full">
                          新会话
                          {log.session_id && (
                            <span className="font-mono text-amber-500/60">{log.session_id.slice(0, 8)}</span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium truncate">
                          {log.page_title || log.path}
                        </div>
                        <div className="font-mono text-[11px] text-[#666] truncate mt-0.5">{log.path}</div>
                        {log.referrer && (
                          <div className="text-[10px] text-[#808080] mt-1 flex items-center gap-1">
                            <Link2 size={10} />
                            来自 {hostOf(log.referrer)}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-[#808080] whitespace-nowrap tabular-nums shrink-0">
                        {fmtTime(log.ts)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-[#141414] border border-[#2a2a2a] px-3 py-2.5 hover:border-[#444] transition-colors">
      <div className="flex items-center gap-1.5 text-[10px] text-[#808080] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-[#666] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-sm text-[#e5e5e5] ${mono ? 'font-mono text-xs break-all' : 'font-medium'}`}>
        {value}
      </div>
    </div>
  );
}

function formatDevice(device: Device): string {
  const parts: string[] = [];
  if (device.device === 'mobile') parts.push('Mobile');
  else if (device.device === 'tablet') parts.push('Tablet');
  else parts.push(device.device || 'Desktop');
  if (device.device_vendor) parts.push(device.device_vendor);
  if (device.device_model) parts.push(device.device_model);
  return parts.join(' · ');
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '-';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天 ${hours % 24} 小时`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function fmtTime(date: string | Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}
