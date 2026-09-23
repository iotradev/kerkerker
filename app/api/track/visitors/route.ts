import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { requireAdmin } from '@/lib/require-admin';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 后台展示模型：IP 始终脱敏，不吐 ip_raw */
function toPublicVisitor(v: Record<string, unknown>) {
  const expires = v.ip_raw_expires ? new Date(v.ip_raw_expires as string).getTime() : 0;
  const hasFullIp = !!v.ip_raw && expires > Date.now();
  return {
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
    has_full_ip: hasFullIp,
    _id: (v._id as { toString?: () => string })?.toString?.(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const db = await getDatabase();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();

    const now = Date.now();
    const visitorsCol = db.collection(COLLECTIONS.ACTIVE_VISITORS);

    // 清理已过期的短时完整 IP
    await visitorsCol.updateMany(
      { ip_raw_expires: { $lt: new Date() } },
      { $set: { ip_raw: null, ip_raw_expires: null } },
    );

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

    // 仅保留「全部访客」
    const visitors = await visitorsCol
      .find(searchFilter)
      .sort({ last_seen: -1 })
      .limit(500)
      .toArray();

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
      uniqueHashCount,
      totalPageViews,
    ] = await Promise.all([
      visitorsCol.countDocuments({ last_seen: { $gte: todayStart } }),
      visitorsCol.countDocuments({ first_seen: { $gte: todayStart } }),
      visitorsCol.countDocuments({
        first_seen: { $lt: todayStart },
        last_seen: { $gte: todayStart },
      }),
      visitorsCol.countDocuments({}),
      // 用不可逆哈希统计独立 IP
      visitorsCol.distinct('ip_hash', { ip_hash: { $nin: [null, ''] } }),
      visitorsCol
        .aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$page_views', 0] } } } }])
        .toArray(),
    ]);

    return NextResponse.json({
      visitors: visitors.map(toPublicVisitor),
      stats: {
        online: onlineCount,
        total: visitors.length,
        today: todayVisitors,
        today_new: todayNew,
        today_returning: todayReturning,
        all_time: allTimeTotal,
        unique_ips: uniqueHashCount.length,
        total_page_views: totalPageViews[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error('Admin visitors API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
