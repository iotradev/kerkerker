export const dynamic = 'force-dynamic';

import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import Link from 'next/link';

interface PageLog {
  path: string;
  page_title?: string;
  ts: Date;
  browser?: string;
  os?: string;
  device?: string;
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ device_id: string }>;
}) {
  const { device_id } = await params;
  const db = await getDatabase();

  const device = await db.collection(COLLECTIONS.ACTIVE_VISITORS).findOne(
    { device_id },
    { projection: { _id: 0 } },
  );

  const now = Date.now();
  const isOnline = device && now - new Date(device.last_seen).getTime() < 35000;

  const pageLog = await db
    .collection<PageLog>(COLLECTIONS.TRACK_PAGE_LOG)
    .find({ device_id })
    .sort({ ts: -1 })
    .limit(100)
    .toArray();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-gray-500">{isOnline ? '在线' : '离线'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* 设备摘要卡片 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="font-mono text-xs text-gray-500 break-all mb-4">{device_id}</p>
          {device ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">操作系统</div>
                <div className="font-medium text-sm text-gray-800">{device.os || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">设备类型</div>
                <div className="font-medium text-sm text-gray-800">{device.device || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">浏览器</div>
                <div className="font-medium text-sm text-gray-800">{device.browser || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">首次访问</div>
                <div className="font-medium text-sm text-gray-800">
                  {device.first_seen ? fmtTime(device.first_seen) : '-'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">设备记录已过期</p>
          )}
        </div>

        {/* 页面访问历史 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">
              页面访问历史
              <span className="text-gray-400 font-normal ml-2">最近 {pageLog.length} 条</span>
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
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">{log.path}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTime(log.ts)}</td>
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

function fmtTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}
