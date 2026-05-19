import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';

export async function POST(req: NextRequest) {
  try {
    const { device_id, current_page } = await req.json();

    if (!device_id || !current_page) {
      return NextResponse.json(
        { error: 'device_id and current_page are required' },
        { status: 400 },
      );
    }

    const db = await getDatabase();
    const now = new Date();

    await db.collection(COLLECTIONS.ACTIVE_VISITORS).updateOne(
      { device_id },
      {
        $set: { current_page, last_seen: now },
        $setOnInsert: { first_seen: now },
      },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
