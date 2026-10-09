import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { requireAdmin } from '@/lib/require-admin';

export async function POST() {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const db = await getDatabase();

    const botFilter = {
      $or: [
        { browser: /headless/i },
        { ua: /headless|bot|crawl|spider|scrape|slurp|facebook|twitter|discord|telegram|whatsapp/i },
      ],
    };
    const visitors = db.collection(COLLECTIONS.ACTIVE_VISITORS);
    const botDevices = await visitors.find(botFilter).project({ device_id: 1, _id: 0 }).toArray();
    const deviceIds = botDevices.map((visitor) => visitor.device_id);
    const delVisitors = await visitors.deleteMany(botFilter);
    const delLogs = deviceIds.length
      ? await db.collection(COLLECTIONS.TRACK_PAGE_LOG).deleteMany({ device_id: { $in: deviceIds } })
      : { deletedCount: 0 };
    if (deviceIds.length) {
      await db.collection(COLLECTIONS.TRACK_SESSIONS).deleteMany({ device_id: { $in: deviceIds } });
    }

    return NextResponse.json({
      ok: true,
      deleted_visitors: delVisitors.deletedCount,
      deleted_logs: delLogs.deletedCount,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
