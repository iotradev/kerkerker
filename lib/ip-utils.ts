/**
 * IP 处理工具
 * - 列表/详情「展示」始终使用脱敏 IP
 * - 可选：后台另存完整 IP 哈希（始终）+ 短时完整 IP（开关控制）
 */
import { createHash } from 'crypto';

/** IP 脱敏：IPv4 保留前两段，其余替换为 * */
export function maskIp(ip: string): string {
  if (!ip) return '';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return ip.length > 8 ? `${ip.slice(0, 8)}****` : '****';
}

/** 完整 IP 的 SHA-256 哈希，用于去重统计，不可逆 */
export function hashIp(ip: string): string {
  if (!ip) return '';
  return createHash('sha256').update(ip).digest('hex');
}

/** 是否存储短时完整 IP（默认关闭） */
export function shouldStoreFullIp(): boolean {
  const v = (process.env.TRACK_STORE_FULL_IP || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/** 短时完整 IP 保留小时数（默认 24） */
export function fullIpTtlHours(): number {
  const n = Number(process.env.TRACK_FULL_IP_TTL_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

/** 短时完整 IP 过期时间 */
export function fullIpExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + fullIpTtlHours() * 60 * 60 * 1000);
}

/** 供 API 返回的访客视图：永不吐出 ip_raw */
export function publicIpFields(doc: {
  ip?: string;
  ip_hash?: string;
  ip_raw?: string;
  ip_raw_expires?: Date | string;
}): {
  ip: string;
  ip_hash?: string;
  has_full_ip: boolean;
} {
  const expires = doc.ip_raw_expires ? new Date(doc.ip_raw_expires).getTime() : 0;
  const fullAlive = !!doc.ip_raw && expires > Date.now();
  return {
    ip: doc.ip || '',
    // 列表不暴露哈希全文时可截断；统计/管理保留完整哈希便于检索
    ip_hash: doc.ip_hash,
    has_full_ip: fullAlive,
  };
}
