export const dynamic = 'force-dynamic';

import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import Link from 'next/link';

interface PageLog {
  path: string;
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

  const pageLog = await db
    .collection<PageLog>(COLLECTIONS.TRACK_PAGE_LOG)
    .find({ device_id })
    .sort({ ts: -1 })
    .limit(100)
    .toArray();

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none', fontSize: 14 }}>
        &larr; 返回看板
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px' }}>
        设备详情
      </h1>
      <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#666', wordBreak: 'break-all' }}>
        {device_id}
      </p>

      {device && (
        <div style={{ display: 'flex', gap: 24, margin: '16px 0 24px', fontSize: 13, color: '#555' }}>
          <span>OS: <strong>{device.os || '-'}</strong></span>
          <span>Device: <strong>{device.device || '-'}</strong></span>
          <span>Browser: <strong>{device.browser || '-'}</strong></span>
          <span>首次访问: <strong>{device.first_seen ? fmtTime(device.first_seen) : '-'}</strong></span>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        页面访问历史（最近 {pageLog.length} 条）
      </h2>

      {pageLog.length === 0 ? (
        <p style={{ color: '#999' }}>暂无记录</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>页面路径</th>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>访问时间</th>
            </tr>
          </thead>
          <tbody>
            {pageLog.map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                  {log.path}
                </td>
                <td style={{ padding: '10px 12px', color: '#666' }}>{fmtTime(log.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
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
