'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              &larr; 看板
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900">设备详情</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}
            />
            <span className="text-gray-500">{isOnline ? '在线' : '离线'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 设备摘要卡片 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="font-mono text-xs text-gray-500 break-all">{device_id}</p>
            {device?.ua && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer select-none">UA</summary>
                <p className="mt-2 font-mono text-[11px] text-gray-600 break-all max-w-md bg-gray-50 rounded p-2">
                  {device.ua}
                </p>
              </details>
            )}
          </div>

          {insights && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Metric label="页面浏览" value={`${insights.page_views} PV`} />
              <Metric label="独立页面" value={`${insights.unique_pages}`} />
              <Metric label="会话数" value={`${insights.session_count}`} />
              <Metric label="活跃跨度" value={formatDuration(insights.activity_ms)} />
            </div>
          )}

          {device ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <Field label="操作系统" value={[device.os, device.os_version].filter(Boolean).join(' ') || '-'} />
              <Field label="设备类型" value={formatDevice(device)} />
              <Field label="浏览器" value={[device.browser, device.browser_version].filter(Boolean).join(' ') || '-'} />
              <Field label="IP（脱敏）" value={device.ip || '-'} mono />
              <Field label="语言" value={device.language || '-'} />
              <Field label="屏幕 / 视口" value={[device.screen, device.viewport].filter(Boolean).join(' · ') || '-'} mono />
              <Field label="时区" value={device.timezone || '-'} />
              <Field label="来源" value={device.referrer_host || '直接访问'} />
              <Field label="落地页" value={device.first_page || '-'} mono />
              <Field label="首次访问" value={device.first_seen ? fmtTime(device.first_seen) : '-'} />
              <Field label="最后活跃" value={device.last_seen ? fmtTime(device.last_seen) : '-'} />
              <Field label="当前页面" value={device.page_title || device.current_page || '-'} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">设备记录已过期</p>
          )}
        </div>

        {/* 热门页面 */}
        {insights && insights.top_pages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">访问最多的页面</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">页面</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">路径</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">次数</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">最近</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {insights.top_pages.map((p, i) => (
                    <tr key={`${p.path}-${i}`} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-900 font-medium max-w-48 truncate">
                        {p.page_title || '-'}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">{p.path}</td>
                      <td className="px-5 py-3 text-xs text-gray-800 font-medium">{p.count}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtTime(p.last_ts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 页面访问历史 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">
              页面访问历史
              <span className="text-gray-400 font-normal ml-2">
                最近 {pageLog.length} 条
              </span>
            </h2>
          </div>

          {pageLog.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-400 text-sm">暂无访问记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      页面内容
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      页面路径
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      来源 / 会话
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      访问时间
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageLog.map((log, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-900 font-medium max-w-48 truncate">
                        {log.page_title || '-'}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">
                        {log.path}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 max-w-40">
                        <div className="truncate">{log.referrer ? hostOf(log.referrer) : '-'}</div>
                        {log.session_id && (
                          <div className="font-mono text-[10px] text-gray-400 mt-0.5">
                            {log.session_id.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtTime(log.ts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
      <div className="text-[11px] text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-sm text-gray-800 ${mono ? 'font-mono text-xs break-all' : 'font-medium'}`}>
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
