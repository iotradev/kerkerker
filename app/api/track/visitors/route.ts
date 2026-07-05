import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function GET(req: NextRequest) {
  try {
    const db = await getDatabase();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'realtime';

    const now = Date.now();

    let visitors;
    if (scope === 'history') {
      visitors = await db
        .collection(COLLECTIONS.ACTIVE_VISITORS)
        .find()
        .sort({ last_seen: -1 })
        .limit(500)
        .toArray();
    } else {
      const fiveMinAgo = new Date(now - 5 * 60 * 1000);
      visitors = await db
        .collection(COLLECTIONS.ACTIVE_VISITORS)
        .find({ last_seen: { $gte: fiveMinAgo } })
        .sort({ last_seen: -1 })
        .limit(200)
        .toArray();
    }

    const onlineCount = visitors.filter(
      (v) => now - new Date(v.last_seen).getTime() < 35000,
    ).length;

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
