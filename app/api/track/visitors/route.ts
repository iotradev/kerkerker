import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { requireAdmin } from '@/lib/require-admin';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const db = await getDatabase();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'realtime';
    const q = (searchParams.get('q') || '').trim();

    const now = Date.now();
    const visitorsCol = db.collection(COLLECTIONS.ACTIVE_VISITORS);

    const searchFilter = q
      ? {
          $or: [
            { device_id: { $regex: escapeRegex(q), $options: 'i' } },
            { ip: { $regex: escapeRegex(q), $options: 'i' } },
            { page_title: { $regex: escapeRegex(q), $options: 'i' } },
            { current_page: { $regex: escapeRegex(q), $options: 'i' } },
            { browser: { $regex: escapeRegex(q), $options: 'i' } },
            { os: { $regex: escapeRegex(q), $options: 'i' } },
            { language: { $regex: escapeRegex(q), $options: 'i' } },
            { referrer_host: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        }
      : {};

    let visitors;
    if (scope === 'history') {
      visitors = await visitorsCol
        .find(searchFilter)
        .sort({ last_seen: -1 })
        .limit(500)
        .toArray();
    } else {
      const fiveMinAgo = new Date(now - 5 * 60 * 1000);
      visitors = await visitorsCol
        .find({ ...searchFilter, last_seen: { $gte: fiveMinAgo } })
        .sort({ last_seen: -1 })
        .limit(200)
        .toArray();
    }

    const onlineCount = visitors.filter(
      (v) => now - new Date(v.last_seen).getTime() < 35000,
    ).length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayVisitors,
      todayNew,
      todayReturning,
      allTimeTotal,
      uniqueIpList,
      totalPageViews,
      onlineAll,
    ] = await Promise.all([
      visitorsCol.countDocuments({ last_seen: { $gte: todayStart } }),
      visitorsCol.countDocuments({ first_seen: { $gte: todayStart } }),
      visitorsCol.countDocuments({
        first_seen: { $lt: todayStart },
        last_seen: { $gte: todayStart },
      }),
      visitorsCol.countDocuments({}),
      visitorsCol.distinct('ip', { ip: { $nin: [null, ''] } }),
      visitorsCol
        .aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$page_views', 0] } } } }])
        .toArray(),
      visitorsCol.countDocuments({ last_seen: { $gte: new Date(now - 35_000) } }),
    ]);

    return NextResponse.json({
      visitors: visitors.map((v) => ({
        device_id: v.device_id,
        current_page: v.current_page,
        page_title: v.page_title,
        last_seen: v.last_seen,
        first_seen: v.first_seen,
        first_page: v.first_page,
        os: v.os,
        os_version: v.os_version,
        device: v.device,
        device_vendor: v.device_vendor,
        device_model: v.device_model,
        browser: v.browser,
        browser_version: v.browser_version,
        ip: v.ip,
        language: v.language,
        screen: v.screen,
        timezone: v.timezone,
        referrer: v.referrer,
        referrer_host: v.referrer_host,
        page_views: v.page_views ?? 0,
        session_count: v.session_count ?? 0,
        _id: v._id?.toString(),
      })),
      stats: {
        online: onlineCount,
        online_all: onlineAll,
        total: visitors.length,
        today: todayVisitors,
        today_new: todayNew,
        today_returning: todayReturning,
        all_time: allTimeTotal,
        unique_ips: uniqueIpList.length,
        total_page_views: totalPageViews[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error('Admin visitors API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
