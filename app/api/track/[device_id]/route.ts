import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { requireAdmin } from '@/lib/require-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ device_id: string }> },
) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { device_id } = await params;
    const db = await getDatabase();
    const visitorsCol = db.collection(COLLECTIONS.ACTIVE_VISITORS);
    const pageLogCol = db.collection(COLLECTIONS.TRACK_PAGE_LOG);

    const device = await visitorsCol.findOne(
      { device_id },
      { projection: { _id: 0 } },
    );

    const now = Date.now();
    const isOnline = device && now - new Date(device.last_seen).getTime() < 35000;

    const [pageLog, statsAgg, topPages, sessionCount, pathCount] = await Promise.all([
      pageLogCol
        .find({ device_id })
        .sort({ ts: -1 })
        .limit(200)
        .toArray(),
      pageLogCol
        .aggregate([
          { $match: { device_id } },
          {
            $group: {
              _id: null,
              page_views: { $sum: 1 },
              unique_pages: { $addToSet: '$path' },
              first_ts: { $min: '$ts' },
              last_ts: { $max: '$ts' },
              sessions: { $addToSet: { $ifNull: ['$session_id', 'unknown'] } },
            },
          },
        ])
        .toArray(),
      pageLogCol
        .aggregate([
          { $match: { device_id } },
          {
            $group: {
              _id: { path: '$path', page_title: '$page_title' },
              count: { $sum: 1 },
              last_ts: { $max: '$ts' },
            },
          },
          { $sort: { count: -1, last_ts: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
      pageLogCol.distinct('session_id', { device_id, session_id: { $exists: true } }),
      pageLogCol.distinct('path', { device_id }),
    ]);

    const stats = statsAgg[0] || null;
    const activityMs =
      device?.first_seen && device?.last_seen
        ? new Date(device.last_seen).getTime() - new Date(device.first_seen).getTime()
        : 0;

    return NextResponse.json({
      device: device
        ? {
            ...device,
            page_views: device.page_views ?? stats?.page_views ?? 0,
            session_count: device.session_count ?? sessionCount.length ?? 0,
            _id: device._id?.toString(),
          }
        : null,
      isOnline: !!isOnline,
      pageLog: pageLog.map((log) => ({
        path: log.path,
        page_title: log.page_title,
        ts: log.ts,
        session_id: log.session_id,
        referrer: log.referrer,
        _id: log._id?.toString(),
      })),
      insights: {
        page_views: device?.page_views ?? stats?.page_views ?? 0,
        unique_pages: pathCount.length,
        session_count: device?.session_count ?? sessionCount.length ?? 0,
        activity_ms: activityMs,
        first_ts: stats?.first_ts ?? device?.first_seen ?? null,
        last_ts: stats?.last_ts ?? device?.last_seen ?? null,
        top_pages: topPages.map((p) => ({
          path: p._id?.path,
          page_title: p._id?.page_title,
          count: p.count,
          last_ts: p.last_ts,
        })),
      },
    });
  } catch (error) {
    console.error('Admin device detail API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
