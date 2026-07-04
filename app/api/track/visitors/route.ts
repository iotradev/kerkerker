import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function GET() {
  try {
    const db = await getDatabase();

    // 只查询最近 5 分钟活跃的访客，限制 200 条
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const visitors = await db
      .collection(COLLECTIONS.ACTIVE_VISITORS)
      .find({ last_seen: { $gte: fiveMinAgo } })
      .sort({ last_seen: -1 })
      .limit(200)
      .toArray();

    // 统计在线（35 秒内活跃）
    const now = Date.now();
    const onlineCount = visitors.filter(
      (v) => now - new Date(v.last_seen).getTime() < 35000,
    ).length;

    // 今日访问量
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayVisitors = await db
      .collection(COLLECTIONS.ACTIVE_VISITORS)
      .countDocuments({ first_seen: { $gte: todayStart } });

    return NextResponse.json({
      visitors: visitors.map((v) => ({
        ...v,
        _id: v._id?.toString(),
      })),
      stats: {
        online: onlineCount,
        total: visitors.length,
        today: todayVisitors,
      },
    });
  } catch (error) {
    console.error('Admin visitors API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
