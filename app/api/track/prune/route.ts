import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function POST(req: NextRequest) {
  try {
    const { days } = await req.json();
    const threshold = typeof days === 'number' && days > 0 ? days : 7;

    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);
    const db = await getDatabase();

    const filter = { last_seen: { $lt: cutoff } };

    const delVisitors = await db.collection(COLLECTIONS.ACTIVE_VISITORS).deleteMany(filter);

    return NextResponse.json({
      ok: true,
      deleted_visitors: delVisitors.deletedCount,
      threshold_days: threshold,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
