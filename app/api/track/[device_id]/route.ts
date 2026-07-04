import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ device_id: string }> },
) {
  try {
    const { device_id } = await params;
    const db = await getDatabase();

    const device = await db.collection(COLLECTIONS.ACTIVE_VISITORS).findOne(
      { device_id },
      { projection: { _id: 0 } },
    );

    const now = Date.now();
    const isOnline = device && now - new Date(device.last_seen).getTime() < 35000;

    const pageLog = await db
      .collection(COLLECTIONS.TRACK_PAGE_LOG)
      .find({ device_id })
      .sort({ ts: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      device: device
        ? { ...device, _id: device._id?.toString() }
        : null,
      isOnline: !!isOnline,
      pageLog: pageLog.map((log) => ({
        ...log,
        _id: log._id?.toString(),
      })),
    });
  } catch (error) {
    console.error('Admin device detail API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
