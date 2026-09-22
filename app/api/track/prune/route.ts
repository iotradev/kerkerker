import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(req: NextRequest) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { days } = await req.json();
    const threshold = typeof days === 'number' && days > 0 ? days : 7;

    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);
    const db = await getDatabase();

    const filter = { last_seen: { $lt: cutoff } };
    const staleDevices = await db
      .collection(COLLECTIONS.ACTIVE_VISITORS)
      .find(filter)
      .project({ device_id: 1, _id: 0 })
      .toArray();
    const deviceIds = staleDevices.map((d) => d.device_id);

    const delVisitors = await db.collection(COLLECTIONS.ACTIVE_VISITORS).deleteMany(filter);
    const delLogs = deviceIds.length
      ? await db.collection(COLLECTIONS.TRACK_PAGE_LOG).deleteMany({ device_id: { $in: deviceIds } })
      : { deletedCount: 0 };

    return NextResponse.json({
      ok: true,
      deleted_visitors: delVisitors.deletedCount,
      deleted_logs: delLogs.deletedCount,
      threshold_days: threshold,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
