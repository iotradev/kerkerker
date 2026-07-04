import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { UAParser } from 'ua-parser-js';

const BOT_RE = /bot|crawl|spider|scrape|headless|slurp|facebook|twitter|discord|telegram|whatsapp/i;

/** IP 脱敏：保留前两段，后两段替换为 * */
function maskIp(ip: string): string {
  if (!ip) return '';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 或其他格式，只保留前 4 个字符
  return ip.length > 8 ? `${ip.slice(0, 8)}****` : '****';
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, current_page, page_title } = await req.json();

    if (!device_id || !current_page) {
      return NextResponse.json(
        { error: 'device_id and current_page are required' },
        { status: 400 },
      );
    }

    const ua = req.headers.get('user-agent') || '';

    // 后端 Bot 过滤
    if (BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, bot: true });
    }

    const parsed = new UAParser(ua);
    const browser = parsed.getBrowser().name || 'Unknown';
    const os = parsed.getOS().name || 'Unknown';
    const device = parsed.getDevice().type || 'Desktop';
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const ip = maskIp(rawIp);

    const db = await getDatabase();
    const now = new Date();

    const setFields: Record<string, unknown> = {
      current_page,
      last_seen: now,
      browser,
      os,
      device,
      ip,
      ua,
    };
    if (page_title) {
      setFields.page_title = page_title;
    }

    // upsert 设备信息
    await db.collection(COLLECTIONS.ACTIVE_VISITORS).updateOne(
      { device_id },
      {
        $set: setFields,
        $setOnInsert: { first_seen: now },
      },
      { upsert: true },
    );

    // 日志去重：仅当页面路径变化时才插入日志（避免心跳产生重复日志）
    const lastLog = await db
      .collection<{ path: string }>(COLLECTIONS.TRACK_PAGE_LOG)
      .findOne({ device_id }, { sort: { ts: -1 }, projection: { path: 1, _id: 0 } });

    if (!lastLog || lastLog.path !== current_page) {
      const logEntry: Record<string, unknown> = {
        device_id,
        path: current_page,
        ts: now,
      };
      if (page_title) {
        logEntry.page_title = page_title;
      }

      await db.collection(COLLECTIONS.TRACK_PAGE_LOG).insertOne(logEntry);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
