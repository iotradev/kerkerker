export const dynamic = 'force-dynamic';

import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

interface Visitor {
  device_id: string;
  current_page: string;
  page_title?: string;
  last_seen: Date;
  first_seen: Date;
  os?: string;
  device?: string;
  browser?: string;
  ip?: string;
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

export default async function AdminPage() {
  const db = await getDatabase();
  const visitors = await db
    .collection<Visitor>(COLLECTIONS.ACTIVE_VISITORS)
    .find({})
    .sort({ last_seen: -1 })
    .toArray();

  const now = Date.now();
  const online = visitors.filter((v) => now - new Date(v.last_seen).getTime() < 35000);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">实时访客监控</h1>
            <p className="text-sm text-gray-500 mt-0.5">Realtime Visitor Dashboard</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{online.length}</div>
              <div className="text-xs text-gray-500">在线</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{visitors.length}</div>
              <div className="text-xs text-gray-500">总计</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {visitors.length === 0 ? (
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
                                isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-200' : 'bg-gray-300'
                              }`}
                            />
                            <a
                              href={`/admin/${v.device_id}`}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {v.device_id.slice(0, 8)}...
                            </a>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {OS_ICONS[v.os || ''] && `${OS_ICONS[v.os || '']} `}{v.os || '-'}
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
                            {BROWSER_ICONS[v.browser || ''] && `${BROWSER_ICONS[v.browser || '']} `}{v.browser || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-56">
                          {v.page_title ? (
                            <div>
                              <span className="text-xs text-gray-900 font-medium truncate block">
                                {v.page_title}
                              </span>
                              <span className="font-mono text-[10px] text-gray-400 truncate block mt-0.5" title={v.current_page}>
                                {v.current_page}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-gray-600 truncate block" title={v.current_page}>
                              {v.current_page}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(v.last_seen)}
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}
