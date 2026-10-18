import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { getDatabase } from '@/lib/db';
import { COLLECTIONS } from '@/lib/constants/db';
import {
  hashIp,
  maskIp,
  shouldStoreFullIp,
  fullIpExpiresAt,
} from '@/lib/ip-utils';
import { UAParser } from 'ua-parser-js';
import { isLikelyBotUa } from '@/lib/track/bot-filter';

/** 有效页面路径模式 */
const VALID_PATH_PATTERNS = [
  /^\/$/,
  /^\/browse\/(latest|movies|tv)$/,
  /^\/(movie|play|category)\/[^/?#]{1,200}$/,
  /^\/search(?:\/|$)/,
  /^\/calendar(?:\/|$)/,
  /^\/dailymotion(?:\/|$)/,
  /^\/history(?:\/|$)/,
  /^\/shorts(?:\/|$)/,
];

/** UUID v4 格式 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 简单内存速率限制 */
const RATE_LIMIT_MAP = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(key: string, max = RATE_LIMIT_MAX): boolean {
  const count = RATE_LIMIT_MAP.get(key) || 0;
  if (count >= max) {
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
    }
    const {
      device_id,
      current_page,
      page_view_id,
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

    if (!device_id || typeof current_page !== 'string' || current_page.length > 512) {
      return NextResponse.json(
        { error: 'device_id and current_page are required' },
        { status: 400 },
      );
    }
    if (typeof device_id !== 'string' || !UUID_V4_RE.test(device_id)) {
      return NextResponse.json({ error: 'invalid device_id' }, { status: 400 });
    }
    if (session_id && (typeof session_id !== 'string' || !UUID_V4_RE.test(session_id))) {
      return NextResponse.json({ error: 'invalid session_id' }, { status: 400 });
    }
    if (page_view_id && (typeof page_view_id !== 'string' || !UUID_V4_RE.test(page_view_id))) {
      return NextResponse.json({ error: 'invalid page_view_id' }, { status: 400 });
    }

    // Keep malformed clients from reaching storage; this public token is not authentication.
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
    if (host && origin) {
      try {
        if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
          return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
      }
    }
    if (host && referer) {
      try {
        if (new URL(referer).host.toLowerCase() !== host.toLowerCase()) {
          return NextResponse.json({ error: 'invalid referer' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'invalid referer' }, { status: 403 });
      }
    }

    const ipCandidate = (req.headers.get('x-real-ip')?.trim()
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || '').slice(0, 64);
    const rawIp = isIP(ipCandidate) ? ipCandidate : '';

    // 速率限制（按 device_id）
    if (isRateLimited(device_id) || (rawIp && isRateLimited(`ip:${rawIp}`, 100))) {
      return NextResponse.json({ ok: true, rate_limited: true });
    }

    const ua = req.headers.get('user-agent') || '';

    // 后端 Bot 过滤
    if (isLikelyBotUa(ua)) {
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
    const ip = maskIp(rawIp);
    const ipHash = hashIp(rawIp);

    const db = await getDatabase();
    const now = new Date();
    const visitors = db.collection(COLLECTIONS.ACTIVE_VISITORS);
    const pageLogs = db.collection(COLLECTIONS.TRACK_PAGE_LOG);

    const existing = await visitors.findOne(
      { device_id },
      { projection: { _id: 1 } },
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
      ip_hash: ipHash,
      ua: ua.slice(0, 1000),
    };

    if (rawIp) {
      if (shouldStoreFullIp()) {
        setFields.ip_raw = rawIp;
        setFields.ip_raw_expires = fullIpExpiresAt(now);
      } else {
        setFields.ip_raw = null;
        setFields.ip_raw_expires = null;
      }
    }
    if (typeof page_title === 'string') setFields.page_title = page_title.slice(0, 200);
    if (typeof language === 'string') setFields.language = language.slice(0, 64);
    if (typeof languages === 'string') setFields.languages = languages.slice(0, 256);
    if (typeof screen === 'string') setFields.screen = screen.slice(0, 32);
    if (typeof viewport === 'string') setFields.viewport = viewport.slice(0, 32);
    if (typeof timezone === 'string') setFields.timezone = timezone.slice(0, 64);
    if (typeof tz_offset === 'string' && tz_offset.length <= 8) setFields.tz_offset = tz_offset;

    const insertFields: Record<string, unknown> = {
      first_seen: now,
      first_page: current_page,
      page_views: 0,
      session_count: 0,
    };
    // 来源只在首次写入，避免被后续心跳覆盖
    if (isNew && referrer !== undefined) {
      insertFields.referrer_host = extractReferrerHost(typeof referrer === 'string' ? referrer : '');
    }

    const updateOps: Record<string, unknown> = {
      $set: setFields,
      $setOnInsert: insertFields,
    };
    try {
      await visitors.updateOne({ device_id }, updateOps, { upsert: true });
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      await visitors.updateOne({ device_id }, { $set: setFields });
    }

    if (session_id) {
      const sessions = db.collection(COLLECTIONS.TRACK_SESSIONS);
      let newSession = false;
      try {
        const result = await sessions.updateOne(
          { device_id, session_id },
          { $set: { last_seen: now }, $setOnInsert: { first_seen: now } },
          { upsert: true },
        );
        newSession = result.upsertedCount > 0;
      } catch (error) {
        if ((error as { code?: number })?.code !== 11000) throw error;
        await sessions.updateOne({ device_id, session_id }, { $set: { last_seen: now } });
      }
      if (newSession) await visitors.updateOne({ device_id }, { $inc: { session_count: 1 } });
    }

    // Unique page_view_id makes retries and parallel tabs idempotent.
    const logEntry: Record<string, unknown> = {
      device_id,
      path: current_page,
      ts: now,
    };
    if (page_view_id) logEntry.page_view_id = page_view_id;
    if (typeof page_title === 'string') logEntry.page_title = page_title.slice(0, 200);
    if (session_id) logEntry.session_id = session_id;
    const referrerHost = extractReferrerHost(typeof referrer === 'string' ? referrer : '');
    if (referrerHost) logEntry.referrer_host = referrerHost;

    let shouldCountPageView = false;
    if (page_view_id) {
      try {
        await pageLogs.insertOne(logEntry);
        shouldCountPageView = true;
      } catch (error) {
        if ((error as { code?: number })?.code !== 11000) throw error;
      }
    } else {
      const lastLog = await pageLogs.findOne(
        { device_id },
        { sort: { ts: -1 }, projection: { path: 1, _id: 0 } },
      );
      shouldCountPageView = !lastLog || lastLog.path !== current_page;
      if (shouldCountPageView) await pageLogs.insertOne(logEntry);
    }
    if (shouldCountPageView) {
      await visitors.updateOne({ device_id }, { $inc: { page_views: 1 } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
