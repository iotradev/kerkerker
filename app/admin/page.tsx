export const dynamic = 'force-dynamic';

import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

interface Visitor {
  device_id: string;
  current_page: string;
  last_seen: Date;
  first_seen: Date;
  os?: string;
  device?: string;
  browser?: string;
}

export default async function AdminPage() {
  const db = await getDatabase();
  const visitors = await db
    .collection<Visitor>(COLLECTIONS.ACTIVE_VISITORS)
    .find({})
    .sort({ last_seen: -1 })
    .toArray();

  const now = Date.now();

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>实时访客监控</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        当前在线访客：<strong>{visitors.length}</strong>
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>Device ID</th>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>OS</th>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>Device</th>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>Browser</th>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>当前页面</th>
            <th style={{ padding: '10px 12px', borderBottom: '2px solid #ddd' }}>最后活跃</th>
          </tr>
        </thead>
        <tbody>
          {visitors.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                暂无在线访客
              </td>
            </tr>
          ) : (
            visitors.map((v) => {
              const lastSeen = new Date(v.last_seen).getTime();
              const secondsAgo = Math.floor((now - lastSeen) / 1000);
              const isOnline = secondsAgo <= 35;

              return (
                <tr key={v.device_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: isOnline ? '#22c55e' : '#d1d5db',
                        marginRight: 8,
                      }}
                    />
                    <a
                      href={`/admin/${v.device_id}`}
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                      className="hover-underline"
                    >
                      {v.device_id.slice(0, 8)}...
                    </a>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{v.os || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{v.device || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{v.browser || '-'}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.current_page}</td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{formatTime(v.last_seen)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </main>
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
