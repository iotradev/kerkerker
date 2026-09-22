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
  /^\/history/,
  /^\/shorts/,
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

/** 从来源 URL 提取可读来源域名 */
function extractReferrerHost(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).host;
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      device_id,
      current_page,
      page_title,
      track_token,
      session_id,
      referrer,
      language,
      languages,
      screen,
      viewport,
      timezone,
      tz_offset,
    } = body;

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
    const browserVersion = parsed.getBrowser().version || '';
    const os = parsed.getOS().name || 'Unknown';
    const osVersion = parsed.getOS().version || '';
    const device = parsed.getDevice().type || 'Desktop';
    const deviceVendor = parsed.getDevice().vendor || '';
    const deviceModel = parsed.getDevice().model || '';
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const ip = maskIp(rawIp);

    const db = await getDatabase();
    const now = new Date();
    const visitors = db.collection(COLLECTIONS.ACTIVE_VISITORS);
    const pageLogs = db.collection(COLLECTIONS.TRACK_PAGE_LOG);

    const existing = await visitors.findOne(
      { device_id },
      { projection: { last_session_id: 1, _id: 0 } },
    );
    const isNew = !existing;

    const setFields: Record<string, unknown> = {
      current_page,
      last_seen: now,
      browser,
      browser_version: browserVersion,
      os,
      os_version: osVersion,
      device,
      device_vendor: deviceVendor,
      device_model: deviceModel,
      ip,
      ua,
    };
    if (page_title) setFields.page_title = page_title;
    if (language) setFields.language = language;
    if (languages) setFields.languages = languages;
    if (screen) setFields.screen = screen;
    if (viewport) setFields.viewport = viewport;
    if (timezone) setFields.timezone = timezone;
    if (tz_offset !== undefined && tz_offset !== '') setFields.tz_offset = tz_offset;

    const insertFields: Record<string, unknown> = {
      first_seen: now,
      first_page: current_page,
      page_views: 0,
      session_count: 0,
    };
    // 来源只在首次写入，避免被后续心跳覆盖
    if (isNew && referrer !== undefined) {
      insertFields.referrer = referrer || '';
      insertFields.referrer_host = extractReferrerHost(referrer || '');
    }

    const incFields: Record<string, number> = {};
    if (session_id) {
      if (isNew) {
        insertFields.session_count = 1;
        insertFields.last_session_id = session_id;
      } else if (!existing?.last_session_id || existing.last_session_id !== session_id) {
        // 新会话：累加次数（字段不能同时出现在 $setOnInsert / $inc）
        incFields.session_count = 1;
        setFields.last_session_id = session_id;
      }
    }

    const updateOps: Record<string, unknown> = {
      $set: setFields,
      $setOnInsert: insertFields,
    };
    if (Object.keys(incFields).length > 0) {
      updateOps.$inc = incFields;
    }

    await visitors.updateOne({ device_id }, updateOps, { upsert: true });

    // 页面切换时记录日志并累加 PV（同一路径的心跳不重复计）
    const lastLog = await pageLogs.findOne(
      { device_id },
      { sort: { ts: -1 }, projection: { path: 1, _id: 0 } },
    );

    const isPageChange = !lastLog || lastLog.path !== current_page;
    if (isPageChange) {
      const logEntry: Record<string, unknown> = {
        device_id,
        path: current_page,
        ts: now,
      };
      if (page_title) logEntry.page_title = page_title;
      if (session_id) logEntry.session_id = session_id;
      if (referrer) logEntry.referrer = referrer;

      await pageLogs.insertOne(logEntry);
      await visitors.updateOne({ device_id }, { $inc: { page_views: 1 } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
