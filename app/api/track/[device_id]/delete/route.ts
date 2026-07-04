import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ device_id: string }> }) {
  try {
    const { device_id } = await params;
    if (!device_id) return NextResponse.json({ ok: false, error: 'missing device_id' }, { status: 400 });

    const db = await getDatabase();
    const del = await db.collection(COLLECTIONS.ACTIVE_VISITORS).deleteOne({ device_id });

    return NextResponse.json({ ok: true, deleted: del.deletedCount });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
