import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { createAdminSessionToken, validateAdminSessionToken } from '@/lib/session-token';

// Session cookie 名称
const SESSION_COOKIE_NAME = 'admin_session';

// 获取管理员密码（运行时动态读取环境变量，避免构建时被内联）
function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || '';
}

// 创建会话
export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

// 删除会话
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// 验证会话
export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return validateAdminSessionToken(session?.value);
}

// 验证密码
export function validatePassword(password: string): boolean {
  const expected = getAdminPassword();
  if (!expected || !password) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(password);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function isAdminPasswordConfigured(): boolean {
  return !!getAdminPassword();
}
