import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import { UAParser } from 'ua-parser-js';

const BOT_RE = /bot|crawl|spider|scrape|headless|slurp|facebook|twitter|discord|telegram|whatsapp/i;

/** 有效页面路径模式 */
const VALID_PATH_PATTERNS = [
  /^\/$/,
  /^\/browse\/(latest|movies|tv)$/,
  /^\/movie\/[a-zA-Z0-9_]+$/,
  /^\/play\/[a-zA-Z0-9_]+$/,
  /^\/category\/[a-zA-Z0-9_]+$/,
  /^\/search/,
  /^\/calendar/,
  /^\/dailymotion/,
];

/** UUID v4 格式 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 简单内存速率限制 */
const RATE_LIMIT_MAP = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5_000;
const RATE_LIMIT_MAX = 3;

function isRateLimited(key: string): boolean {
  const count = RATE_LIMIT_MAP.get(key) || 0;
  if (count >= RATE_LIMIT_MAX) {
    return true;
  }
  RATE_LIMIT_MAP.set(key, count + 1);
  setTimeout(() => {
    const c = RATE_LIMIT_MAP.get(key) || 1;
    if (c <= 1) RATE_LIMIT_MAP.delete(key);
    else RATE_LIMIT_MAP.set(key, c - 1);
  }, RATE_LIMIT_WINDOW);
  return false;
}

function isValidPath(path: string): boolean {
  return VALID_PATH_PATTERNS.some((re) => re.test(path));
}

/** IP 脱敏：保留前两段，后两段替换为 * */
function maskIp(ip: string): string {
  if (!ip) return '';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return ip.length > 8 ? `${ip.slice(0, 8)}****` : '****';
}

export async function POST(req: NextRequest) {
  try {
    const { device_id, current_page, page_title, track_token } = await req.json();

    if (!device_id || !current_page) {
      return NextResponse.json(
        { error: 'device_id and current_page are required' },
        { status: 400 },
      );
    }

    // 校验追踪令牌（防止伪造请求）
    if (!track_token || !UUID_V4_RE.test(track_token)) {
      return NextResponse.json({ error: 'invalid track token' }, { status: 403 });
    }

    // 校验页面路径合法性
    if (!isValidPath(current_page)) {
      return NextResponse.json({ error: 'invalid page path' }, { status: 400 });
    }

    // 校验请求来源
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const host = req.headers.get('host');
    if (origin && !origin.includes(host || '')) {
      return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
    }
    if (referer && !referer.includes(host || '')) {
      return NextResponse.json({ error: 'invalid referer' }, { status: 403 });
    }

    // 速率限制（按 device_id）
    if (isRateLimited(device_id)) {
      return NextResponse.json({ ok: true, rate_limited: true });
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

    await db.collection(COLLECTIONS.ACTIVE_VISITORS).updateOne(
      { device_id },
      {
        $set: setFields,
        $setOnInsert: { first_seen: now },
      },
      { upsert: true },
    );

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
